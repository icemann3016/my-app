import { sql } from "drizzle-orm";
import { beforeAll, expect, it } from "vitest";

import { describeDb, forceListed, prepareDatabase } from "./setup";

let db: typeof import("@/lib/db");
let rls: typeof import("@/lib/db/rls");
let s: typeof import("@/lib/db/schema");

const OWN = "d1d1d1d1-1111-4111-8111-d1d1d1d1d1d1"; // owner
const PIL = "d2d2d2d2-2222-4222-8222-d2d2d2d2d2d2"; // pilot with an accepted booking
const NXT = "d3d3d3d3-3333-4333-8333-d3d3d3d3d3d3"; // pilot with a pending request
const OTH = "d4d4d4d4-4444-4444-8444-d4d4d4d4d4d4"; // someone else
let planeId: string;
let bookingId: string;

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

const conditions = (user: string) =>
  rls
    .asUser(user, (tx) =>
      tx.execute(sql`select requirement from public.my_eligibility(${planeId}::uuid)`),
    )
    .then((rows) => (rows as unknown as { requirement: string }[]).map((r) => r.requirement));

const checkoutRow = () => ({
  aircraftId: planeId,
  pilotId: PIL,
  doneOn: "2026-10-01",
  instructor: "FI Petrov",
});

describeDb("checkout flights", () => {
  beforeAll(async () => {
    await prepareDatabase();
    db = await import("@/lib/db");
    rls = await import("@/lib/db/rls");
    s = await import("@/lib/db/schema");
    const owner = db.getDb();
    await owner.insert(s.users).values([
      { id: OWN, name: "Own", email: "own-c@example.com" },
      { id: PIL, name: "Pil", email: "pil-c@example.com" },
      { id: NXT, name: "Nxt", email: "nxt-c@example.com" },
      { id: OTH, name: "Oth", email: "oth-c@example.com" },
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
        registration: "LZ-CHK",
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
    await owner
      .insert(s.rentalRequirements)
      .values({ aircraftId: planeId, checkoutFirstRental: true });
    await verifiedPilot(PIL);
    await verifiedPilot(NXT);
  }, 60_000);

  it("asks every pilot new to the aircraft for a checkout flight", async () => {
    expect(await conditions(PIL)).toContain("checkout");
    bookingId = await request(PIL, 60 * 24, 60 * 24 + 120);
    const [b] = await db
      .getDb()
      .select({ checkoutRequired: s.bookings.checkoutRequired })
      .from(s.bookings)
      .where(sql`id = ${bookingId}::uuid`);
    expect(b!.checkoutRequired).toBe(true);
  });

  it("lets only the owner record it, and only for pilots who booked the aircraft", async () => {
    const code = (p: Promise<unknown>) =>
      p.then(
        () => undefined,
        (e: { cause?: { code?: string } }) => e.cause?.code,
      );
    expect(
      await code(rls.asUser(PIL, (tx) => tx.insert(s.aircraftCheckouts).values(checkoutRow()))),
    ).toBe("42501");
    expect(
      await code(
        rls.asUser(OWN, (tx) =>
          tx.insert(s.aircraftCheckouts).values({ ...checkoutRow(), pilotId: NXT }),
        ),
      ),
    ).toBe("42501");
    await rls.asUser(OWN, (tx) => tx.insert(s.aircraftCheckouts).values(checkoutRow()));
    expect(await rls.asUser(PIL, (tx) => tx.select().from(s.aircraftCheckouts))).toHaveLength(1);
    expect(await rls.asUser(OTH, (tx) => tx.select().from(s.aircraftCheckouts))).toEqual([]);
  });

  it("stops asking once the checkout is recorded", async () => {
    expect(await conditions(PIL)).not.toContain("checkout");
    expect(await conditions(NXT)).toContain("checkout");
  });
});
