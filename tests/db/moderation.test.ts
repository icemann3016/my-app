import { eq, sql } from "drizzle-orm";
import { beforeAll, expect, it } from "vitest";

import { describeDb, forceListed, prepareDatabase } from "./setup";

let db: typeof import("@/lib/db");
let rls: typeof import("@/lib/db/rls");
let s: typeof import("@/lib/db/schema");
let mod: typeof import("@/lib/admin/moderation");

const ADM = "f1f1f1f1-1111-4111-8111-f1f1f1f1f1f1"; // admin
const OWN = "f2f2f2f2-2222-4222-8222-f2f2f2f2f2f2"; // owner who gets suspended
const PIL = "f3f3f3f3-3333-4333-8333-f3f3f3f3f3f3"; // someone asking about the aircraft
let planeId: string;
let conversationId: string;

const status = async () => {
  const [a] = await db.getDb().select().from(s.aircraft).where(eq(s.aircraft.id, planeId));
  return { status: a!.status, reason: a!.unlistedReason };
};

const listAsOwner = () =>
  rls
    .asUser(OWN, (tx) =>
      tx.update(s.aircraft).set({ status: "listed" }).where(eq(s.aircraft.id, planeId)),
    )
    .then(
      () => "ok",
      (e: { cause?: { code?: string; message?: string } }) => e.cause?.message,
    );

const say = (user: string, body: string) =>
  rls
    .asUser(user, (tx) =>
      tx.execute(sql`select public.send_message(${conversationId}::uuid, ${body})`),
    )
    .then(
      () => "ok",
      (e: { cause?: { message?: string } }) => e.cause?.message,
    );

describeDb("moderation", () => {
  beforeAll(async () => {
    await prepareDatabase();
    db = await import("@/lib/db");
    rls = await import("@/lib/db/rls");
    s = await import("@/lib/db/schema");
    mod = await import("@/lib/admin/moderation");
    const owner = db.getDb();
    await owner.insert(s.users).values([
      { id: ADM, name: "Adm", email: "adm-x@example.com" },
      { id: OWN, name: "Own", email: "own-x@example.com" },
      { id: PIL, name: "Pil", email: "pil-x@example.com" },
    ]);
    await owner.insert(s.userRoles).values({ userId: ADM, role: "admin" });
    await owner.insert(s.airports).values({
      ident: "LBSF",
      type: "large_airport",
      name: "Sofia",
      country: "BG",
      latitude: 42.6952,
      longitude: 23.4062,
      timezone: "Europe/Sofia",
    });
    const [plane] = await owner
      .insert(s.aircraft)
      .values({
        ownerId: OWN,
        registration: "LZ-MOD",
        manufacturer: "Cessna",
        model: "172",
        typeDesignator: "C172",
        seats: 4,
        fuelType: "avgas_100ll",
        homeAirportIdent: "LBSF",
        pricePerHour: 180,
      })
      .returning();
    planeId = plane!.id;
    await forceListed(planeId);
    await owner.insert(s.sessions).values({
      userId: OWN,
      token: "tok-own",
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    const [row] = (await rls.asUser(PIL, (tx) =>
      tx.execute(sql`select public.start_conversation(${planeId}::uuid, null, 'Hi') as id`),
    )) as unknown as { id: string }[];
    conversationId = row!.id;
  }, 60_000);

  it("suspends: logs the user out, unlists their aircraft, stops their messages", async () => {
    expect(await mod.suspendUser(ADM, ADM, null)).toEqual({ ok: false, error: "self" });
    expect(await mod.suspendUser(ADM, OWN, "Spam")).toEqual({ ok: true });
    expect(await mod.suspendUser(ADM, OWN, "Again")).toEqual({ ok: false, error: "notFound" });
    const left = await db.getDb().select().from(s.sessions).where(eq(s.sessions.userId, OWN));
    expect(left).toEqual([]);
    expect(await status()).toEqual({ status: "unlisted", reason: "suspended" });
    expect(await listAsOwner()).toBe("aircraft_blocked");
    expect(await say(OWN, "Hello")).toBe("suspended");
    expect(await say(PIL, "Hello?")).toBe("ok");
  });

  it("lifts a suspension; the owner may list again", async () => {
    expect(await mod.unsuspendUser(ADM, OWN, null)).toEqual({ ok: true });
    expect(await status()).toEqual({ status: "unlisted", reason: null });
    expect(await say(OWN, "Back")).toBe("ok");
  });

  it("keeps an aircraft unlisted by an admin until they allow it", async () => {
    await forceListed(planeId);
    expect(await mod.unlistAircraft(ADM, planeId, "Fake listing")).toEqual({ ok: true });
    expect(await status()).toEqual({ status: "unlisted", reason: "admin" });
    expect(await listAsOwner()).toBe("aircraft_blocked");
    expect(await mod.allowListing(ADM, planeId, null)).toEqual({ ok: true });
    expect(await status()).toEqual({ status: "unlisted", reason: null });
    // Now only the normal listing checks apply (this test aircraft has no documents).
    expect(await listAsOwner()).toBe("aircraft_not_listable");
  });

  it("closes reports once and logs every action", async () => {
    await rls.asUser(PIL, (tx) =>
      tx.insert(s.reports).values({
        reporterId: PIL,
        // The aircraft is unlisted now, so PIL can only report its owner.
        targetType: "user",
        targetId: OWN,
        reason: "misleading",
      }),
    );
    const [report] = await db.getDb().select().from(s.reports);
    expect(await mod.closeReport(ADM, report!.id, "dismissed", "Looks fine")).toEqual({ ok: true });
    expect(await mod.closeReport(ADM, report!.id, "resolved", null)).toEqual({
      ok: false,
      error: "notFound",
    });
    const actions = await db.getDb().select().from(s.adminActions);
    expect(actions.map((a) => a.action).sort()).toEqual([
      "allow_listing",
      "report_dismissed",
      "suspend_user",
      "unlist_aircraft",
      "unsuspend_user",
    ]);
    // Only admins read the audit log.
    expect(await rls.asUser(PIL, (tx) => tx.select().from(s.adminActions))).toEqual([]);
  });

  it("counts the dashboard numbers", async () => {
    const { getMetrics } = await import("@/lib/admin/metrics");
    const m = await getMetrics(30);
    expect(m).toMatchObject({ users: 3, newUsers: 3, openReports: 0, suspended: 0 });
    expect(m.signupsByWeek).toHaveLength(8);
    expect(m.signupsByWeek.at(-1)!.n).toBe(3);
  });

  it("deletes a member only when nothing is open; the owner keeps the pilot's past booking", async () => {
    const owner = db.getDb();
    const booking = async (status: string) => {
      const rows = await owner.execute(sql`
        insert into public.bookings (aircraft_id, pilot_id, owner_id, status, period,
          departure_ident, arrival_ident, purpose, planned_hours, price_per_hour, currency,
          price_basis, time_basis, estimate, expires_at)
        values (${planeId}::uuid, ${PIL}::uuid, ${OWN}::uuid, ${status}::public.booking_status,
          tstzrange(now() + interval '3 days', now() + interval '3 days 2 hours'),
          'LBSF', 'LBSF', 'local', 2, 180, 'EUR', 'wet', 'hobbs', 360, now() + interval '1 day')
        returning id`);
      return (rows as unknown as { id: string }[])[0]!.id;
    };
    const bookingId = await booking("accepted");

    expect(await mod.deleteMember(ADM, ADM, null)).toEqual({ ok: false, error: "self" });
    expect(await mod.deleteMember(OWN, ADM, null)).toEqual({ ok: false, error: "adminAccount" });
    expect(await mod.deleteMember(ADM, PIL, null)).toEqual({
      ok: false,
      error: "activeBookings",
    });

    await owner.execute(
      sql`update public.bookings set status = 'completed' where id = ${bookingId}::uuid`,
    );
    expect(await mod.deleteMember(ADM, PIL, "Asked by email")).toEqual({ ok: true });
    expect(await owner.select().from(s.users).where(eq(s.users.id, PIL))).toEqual([]);
    const [kept] = await owner.select().from(s.bookings).where(eq(s.bookings.id, bookingId));
    expect(kept).toMatchObject({ pilotId: null, ownerId: OWN });
    const [logged] = await owner
      .select()
      .from(s.adminActions)
      .where(eq(s.adminActions.action, "delete_user"));
    expect(logged).toMatchObject({ adminId: ADM, targetId: PIL, reason: "Asked by email" });

    // Deleting the owner removes their aircraft and its bookings.
    expect(await mod.deleteMember(ADM, OWN, null)).toEqual({ ok: true });
    expect(await owner.select().from(s.aircraft).where(eq(s.aircraft.id, planeId))).toEqual([]);
    expect(await mod.deleteMember(ADM, OWN, null)).toEqual({ ok: false, error: "notFound" });
  });
});
