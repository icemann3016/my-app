import { sql } from "drizzle-orm";
import { beforeAll, expect, it } from "vitest";

import { describeDb, forceListed, prepareDatabase } from "./setup";

let db: typeof import("@/lib/db");
let rls: typeof import("@/lib/db/rls");
let s: typeof import("@/lib/db/schema");

const OWN = "c1c1c1c1-1111-4111-8111-c1c1c1c1c1c1"; // owner
const PIL = "c2c2c2c2-2222-4222-8222-c2c2c2c2c2c2"; // pilot with an accepted booking
const NXT = "c3c3c3c3-3333-4333-8333-c3c3c3c3c3c3"; // pilot with a pending request
const OTH = "c4c4c4c4-4444-4444-8444-c4c4c4c4c4c4"; // someone else
let planeId: string;
let bookingId: string;
let requestId: string;

const at = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

async function verifiedPilot(userId: string) {
  const owner = db.getDb();
  await owner.insert(s.pilotLicences).values({
    userId,
    type: "ppl_a",
    issuingState: "BG",
    number: userId.slice(0, 4),
    status: "verified",
  });
  await owner.insert(s.medicals).values({
    userId,
    class: "class2",
    issuingState: "BG",
    validUntil: "2099-01-01",
    status: "verified",
  });
  await owner.insert(s.pilotRatings).values([
    { userId, kind: "class", code: "SEP_LAND", status: "verified" },
    { userId, kind: "privilege", code: "NIGHT", status: "verified" },
  ]);
}

async function request(userId: string, from: number, to: number) {
  const [row] = (await rls.asUser(userId, (tx) =>
    tx.execute(sql`select public.request_booking(${planeId}::uuid,
      tstzrange(${at(from)}::timestamptz, ${at(to)}::timestamptz), 'LBSF', 'LBSF', '{}'::text[],
      'local', 0, 1.5, null, 270) as id`),
  )) as unknown as { id: string }[];
  return row!.id;
}

const mine = (user: string) =>
  rls.asUser(user, (tx) => tx.select().from(s.notifications).orderBy(s.notifications.createdAt));

describeDb("notifications", () => {
  beforeAll(async () => {
    await prepareDatabase();
    db = await import("@/lib/db");
    rls = await import("@/lib/db/rls");
    s = await import("@/lib/db/schema");
    const owner = db.getDb();
    await owner.insert(s.users).values([
      { id: OWN, name: "Own", email: "own-n@example.com" },
      { id: PIL, name: "Pil", email: "pil-n@example.com" },
      { id: NXT, name: "Nxt", email: "nxt-n@example.com" },
      { id: OTH, name: "Oth", email: "oth-n@example.com" },
    ]);
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
        registration: "LZ-NOT",
        manufacturer: "Cessna",
        model: "172",
        typeDesignator: "C172",
        seats: 4,
        fuelType: "avgas_100ll",
        homeAirportIdent: "LBSF",
        pricePerHour: 180,
        nightVfr: true,
      })
      .returning();
    planeId = plane!.id;
    await forceListed(planeId);
    await verifiedPilot(PIL);
    await verifiedPilot(NXT);
  }, 60_000);

  it("tells the other party about each booking event", async () => {
    bookingId = await request(PIL, 60 * 10, 60 * 13);
    expect((await mine(OWN)).map((n) => [n.type, n.actorId])).toEqual([["requested", PIL]]);
    expect(await mine(PIL)).toEqual([]);
    await rls.asUser(OWN, (tx) =>
      tx.execute(sql`select public.respond_to_booking(${bookingId}::uuid, 'accept')`),
    );
    expect((await mine(PIL)).map((n) => n.type)).toEqual(["accepted"]);
    expect(await mine(OTH)).toEqual([]);
  });

  it("lets people read and mark only their own, and never write them", async () => {
    const readAt = new Date();
    const own = await rls.asUser(PIL, (tx) =>
      tx.update(s.notifications).set({ readAt }).returning({ id: s.notifications.id }),
    );
    expect(own).toHaveLength(1);
    const [ownerRow] = await mine(OWN);
    expect(ownerRow!.readAt).toBeNull();
    const code = (p: Promise<unknown>) =>
      p.then(
        () => undefined,
        (e: { cause?: { code?: string } }) => e.cause?.code,
      );
    expect(
      await code(
        rls.asUser(PIL, (tx) =>
          tx.insert(s.notifications).values({ userId: PIL, type: "accepted" }),
        ),
      ),
    ).toBe("42501");
    expect(await code(rls.asUser(PIL, (tx) => tx.update(s.notifications).set({ type: "x" })))).toBe(
      "42501",
    );
  });

  it("notifies both sides when the system acts, and reminds them once", async () => {
    requestId = await request(NXT, 60 * 20, 60 * 22);
    await db.getDb().execute(sql`update public.bookings set expires_at = now() - interval '1 minute'
        where id = ${requestId}::uuid`);
    await db.getDb().execute(sql`select public.expire_booking_requests()`);
    expect((await mine(NXT)).map((n) => n.type)).toEqual(["expired"]);
    expect((await mine(OWN)).map((n) => n.type)).toContain("expired");

    // The accepted booking starts in 10 hours: one reminder each, only once.
    const run = () =>
      db
        .getDb()
        .execute(sql`select public.create_booking_reminders() as n`)
        .then((r) => (r as unknown as { n: number }[])[0]!.n);
    expect(await run()).toBe(1);
    expect(await run()).toBe(0);
    expect((await mine(PIL)).map((n) => n.type)).toContain("reminder");
    expect((await mine(OWN)).map((n) => n.type)).toContain("reminder");
  });

  it("follows each person's email and in-app choices (MSG-3)", async () => {
    // The owner wants booking news by email only, the pilot wants nothing about bookings.
    await rls.asUser(OWN, (tx) =>
      tx
        .update(s.userSettings)
        .set({ inAppBookings: false })
        .where(sql`user_id = ${OWN}::uuid`),
    );
    await rls.asUser(PIL, (tx) =>
      tx
        .update(s.userSettings)
        .set({ inAppBookings: false, emailBookings: false })
        .where(sql`user_id = ${PIL}::uuid`),
    );
    // Nobody may change someone else's choices.
    await rls.asUser(OTH, (tx) =>
      tx
        .update(s.userSettings)
        .set({ emailBookings: false })
        .where(sql`user_id = ${OWN}::uuid`),
    );
    await db
      .getDb()
      .insert(s.bookingEvents)
      .values({ bookingId, actorId: null, type: "log_confirmed" });
    const rows = await db
      .getDb()
      .select()
      .from(s.notifications)
      .where(sql`booking_id = ${bookingId}::uuid and type = 'log_confirmed'`);
    expect(rows.map((r) => r.userId)).toEqual([OWN]);
    expect(rows[0]).toMatchObject({ inApp: false, emailedAt: null });
    // In-app lists leave it out; the email still goes.
    const { listNotifications, unreadCount } = await import("@/lib/notifications");
    const before = await unreadCount(OWN);
    expect((await listNotifications(OWN)).map((n) => n.type)).not.toContain("log_confirmed");
    expect(await unreadCount(OWN)).toBe(before);
    const [owner] = await db
      .getDb()
      .select()
      .from(s.userSettings)
      .where(sql`user_id = ${OWN}::uuid`);
    expect(owner!.emailBookings).toBe(true);
  });
});
