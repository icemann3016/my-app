import { sql } from "drizzle-orm";
import { beforeAll, expect, it } from "vitest";

import { describeDb, forceListed, prepareDatabase } from "./setup";

let db: typeof import("@/lib/db");
let rls: typeof import("@/lib/db/rls");
let s: typeof import("@/lib/db/schema");

const OWN = "c1c1c1c1-1111-4111-8111-c1c1c1c1c1c1"; // owner
const PIL = "c2c2c2c2-2222-4222-8222-c2c2c2c2c2c2"; // pilot of the completed booking
const OTH = "c3c3c3c3-3333-4333-8333-c3c3c3c3c3c3"; // someone else
let planeId: string;
let bookingId: string;
let oldBookingId: string;

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

const pilotScores = { aircraft_condition: 5, communication: 4, value: 3 };
const ownerScores = { airmanship: 5, punctuality: 5, communication: 4, condition_returned: 4 };

async function call<T>(user: string, query: ReturnType<typeof sql>) {
  try {
    return (await rls.asUser(user, (tx) => tx.execute(query))) as unknown as T[];
  } catch (e) {
    const err = e as { cause?: { code?: string; message?: string } };
    return { error: err.cause?.code === "P0001" ? err.cause.message : err.cause?.code };
  }
}

const review = (user: string, booking: string, scores: object, comment = "Great") =>
  call<{ id: string }>(
    user,
    sql`select public.submit_review(${booking}::uuid, ${JSON.stringify(scores)}::jsonb,
      ${comment}) as id`,
  );

/** A booking flown in the past and confirmed by the owner `daysAgo` days ago. */
async function completedBooking(daysAgo: number) {
  const owner = db.getDb();
  // Free the calendar for the next request.
  await owner.execute(sql`delete from public.calendar_entries`);
  const id = await request(PIL, 60 * 24 * 3, 60 * 24 * 3 + 120);
  await owner.execute(sql`update public.bookings set status = 'completed' where id = ${id}`);
  await owner.insert(s.flightLogs).values({
    bookingId: id,
    status: "confirmed",
    confirmedAt: new Date(Date.now() - daysAgo * 86_400_000),
  });
  return id;
}

const visible = (user: string | null) =>
  (user
    ? rls.asUser(user, (tx) => tx.select().from(s.reviews))
    : rls.asAnon((tx) => tx.select().from(s.reviews))
  ).then((rows) => rows.map((r) => r.direction).sort());

const publishDue = async () => {
  const [row] = (await db
    .getDb()
    .execute(sql`select public.publish_due_reviews() as n`)) as unknown as { n: number }[];
  return row!.n;
};

describeDb("reviews", () => {
  beforeAll(async () => {
    await prepareDatabase();
    db = await import("@/lib/db");
    rls = await import("@/lib/db/rls");
    s = await import("@/lib/db/schema");
    const owner = db.getDb();
    await owner.insert(s.users).values([
      { id: OWN, name: "Own", email: "own-r@example.com" },
      { id: PIL, name: "Pil", email: "pil-r@example.com" },
      { id: OTH, name: "Oth", email: "oth-r@example.com" },
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
        registration: "LZ-REV",
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
    bookingId = await completedBooking(1);
    oldBookingId = await completedBooking(20);
  }, 60_000);

  it("lets only the two sides of a completed booking review, once each", async () => {
    expect(await review(OTH, bookingId, pilotScores)).toEqual({ error: "not_found" });
    await db.getDb().execute(sql`delete from public.calendar_entries`);
    const pending = await request(PIL, 60 * 24 * 10, 60 * 24 * 10 + 60);
    expect(await review(PIL, pending, pilotScores)).toEqual({ error: "not_found" });
    expect(await review(PIL, bookingId, { ...pilotScores, value: 6 })).toEqual({
      error: "bad_scores",
    });
    expect(await review(PIL, bookingId, { ...pilotScores, value: 4.5 })).toEqual({
      error: "bad_scores",
    });
    expect(await review(PIL, bookingId, ownerScores)).toEqual({ error: "bad_scores" });
    expect(await review(PIL, bookingId, { ...pilotScores, extra: 1 })).toEqual({
      error: "bad_scores",
    });
    expect(await review(PIL, bookingId, pilotScores)).toHaveLength(1);
    expect(await review(PIL, bookingId, pilotScores)).toEqual({ error: "already_reviewed" });
    expect(await review(PIL, oldBookingId, pilotScores)).toEqual({ error: "window_closed" });
  });

  it("can't be written or changed directly", async () => {
    const code = (p: Promise<unknown>) =>
      p.then(
        () => undefined,
        (e: { cause?: { code?: string } }) => e.cause?.code,
      );
    expect(
      await code(
        rls.asUser(OWN, (tx) =>
          tx.insert(s.reviews).values({
            bookingId,
            direction: "owner_to_pilot",
            authorId: OWN,
            scores: ownerScores,
            overall: 5,
          }),
        ),
      ),
    ).toBe("42501");
    expect(
      await code(rls.asUser(PIL, (tx) => tx.update(s.reviews).set({ publishedAt: new Date() }))),
    ).toBe("42501");
  });

  it("keeps a review hidden from everyone but its author until both sides reviewed", async () => {
    expect(await visible(PIL)).toEqual(["pilot_to_owner"]);
    expect(await visible(OWN)).toEqual([]);
    expect(await visible(OTH)).toEqual([]);
    expect(await visible(null)).toEqual([]);
    const [plane] = await db.getDb().select().from(s.aircraft);
    expect(plane!.ratingCount).toBe(0);
  });

  it("publishes both reviews when the second arrives, and updates the averages", async () => {
    expect(await review(OWN, bookingId, ownerScores)).toHaveLength(1);
    expect(await visible(OTH)).toEqual(["owner_to_pilot", "pilot_to_owner"]);
    expect(await visible(null)).toEqual(["owner_to_pilot", "pilot_to_owner"]);
    const owner = db.getDb();
    const [plane] = await owner.select().from(s.aircraft);
    expect(plane).toMatchObject({ ratingAvg: 4, ratingCount: 1 });
    const profiles = await owner.select().from(s.profiles);
    const pilot = profiles.find((p) => p.id === PIL)!;
    const own = profiles.find((p) => p.id === OWN)!;
    expect(pilot).toMatchObject({ ratingAvg: 4.5, ratingCount: 1, ownerRatingCount: 0 });
    expect(own).toMatchObject({ ownerRatingAvg: 4, ownerRatingCount: 1, ratingCount: 0 });
    const sent = await owner
      .select({ type: s.notifications.type })
      .from(s.notifications)
      .where(sql`booking_id = ${bookingId}::uuid`);
    expect(sent.filter((e) => e.type === "review_submitted")).toHaveLength(2);
    expect(sent.filter((e) => e.type === "reviews_published")).toHaveLength(2);
  });

  it("publishes a lone review once the 14-day window has closed", async () => {
    const lone = await completedBooking(13);
    expect(await review(OWN, lone, ownerScores)).toHaveLength(1);
    expect(await publishDue()).toBe(0);
    await db.getDb().execute(
      sql`update public.flight_logs set confirmed_at = now() - interval '15 days'
          where booking_id = ${lone}::uuid`,
    );
    expect(await publishDue()).toBe(1);
    expect(await visible(OTH)).toHaveLength(3);
    const [pilot] = await db
      .getDb()
      .select()
      .from(s.profiles)
      .where(sql`id = ${PIL}::uuid`);
    expect(pilot).toMatchObject({ ratingAvg: 4.5, ratingCount: 2 });
  });

  it("leaves hidden reviews out of the averages and out of sight", async () => {
    await db.getDb().execute(sql`update public.reviews set hidden_at = now()
      where direction = 'pilot_to_owner'`);
    expect(await visible(OTH)).toEqual(["owner_to_pilot", "owner_to_pilot"]);
    expect(await visible(PIL)).toHaveLength(3);
    const [plane] = await db.getDb().select().from(s.aircraft);
    expect(plane).toMatchObject({ ratingAvg: null, ratingCount: 0 });
  });
});
