import { eq, sql } from "drizzle-orm";
import { beforeAll, expect, it } from "vitest";

import { describeDb, forceListed, prepareDatabase } from "./setup";

let db: typeof import("@/lib/db");
let rls: typeof import("@/lib/db/rls");
let s: typeof import("@/lib/db/schema");

const OWN = "e5e5e5e5-5555-4555-8555-e5e5e5e5e5e5"; // owner
const PIL = "f6f6f6f6-6666-4666-8666-f6f6f6f6f6f6"; // pilot with an accepted booking
const NXT = "a7a7a7a7-7777-4777-8777-a7a7a7a7a7a7"; // pilot with a pending request
const OTH = "b8b8b8b8-8888-4888-8888-b8b8b8b8b8b8"; // someone else
let planeId: string;
let bookingId: string;
let requestId: string;

async function call<T>(user: string, query: ReturnType<typeof sql>) {
  try {
    return (await rls.asUser(user, (tx) => tx.execute(query))) as unknown as T[];
  } catch (e) {
    const err = e as { cause?: { code?: string; message?: string } };
    return { error: err.cause?.code === "P0001" ? err.cause.message : err.cause?.code };
  }
}

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

describeDb("defects and grounding", () => {
  beforeAll(async () => {
    await prepareDatabase();
    db = await import("@/lib/db");
    rls = await import("@/lib/db/rls");
    s = await import("@/lib/db/schema");
    const owner = db.getDb();
    await owner.insert(s.users).values([
      { id: OWN, name: "Own", email: "own-d@example.com" },
      { id: PIL, name: "Pil", email: "pil-d@example.com" },
      { id: NXT, name: "Nxt", email: "nxt-d@example.com" },
      { id: OTH, name: "Oth", email: "oth-d@example.com" },
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
        registration: "LZ-DEF",
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
    bookingId = await request(PIL, 60, 240);
    await rls.asUser(OWN, (tx) =>
      tx.execute(sql`select public.respond_to_booking(${bookingId}::uuid, 'accept')`),
    );
    requestId = await request(NXT, 60 * 24 * 3, 60 * 24 * 3 + 120);
  }, 60_000);

  const report = (user: string, booking: string | null, text = "Oil leak at the left cowl") =>
    call<{ id: string }>(
      user,
      sql`select public.report_defect(${planeId}::uuid, ${booking}::uuid, 'unsafe', ${text}) as id`,
    );

  it("lets the booking's pilot and the owner report, and nobody else", async () => {
    const [byPilot] = (await report(PIL, bookingId)) as { id: string }[];
    expect(byPilot!.id).toBeTruthy();
    expect(await report(OWN, null, "Brake worn")).toHaveLength(1);
    // A pending request isn't enough, nor someone else's booking, nor no booking at all.
    expect(await report(NXT, requestId)).toEqual({ error: "not_found" });
    expect(await report(OTH, bookingId)).toEqual({ error: "not_found" });
    expect(await report(OTH, null)).toEqual({ error: "not_found" });
    expect(await report(PIL, bookingId, "  ")).toEqual({ error: "description_required" });
    // Nobody writes to the table directly.
    const direct = await rls
      .asUser(PIL, (tx) =>
        tx.insert(s.defects).values({
          aircraftId: planeId,
          reportedBy: PIL,
          severity: "minor",
          description: "x",
        }),
      )
      .then(
        () => "inserted",
        (e: { cause?: { code?: string } }) => e.cause?.code,
      );
    expect(direct).toBe("42501");
  });

  it("shows defects to the owner and the reporter only", async () => {
    expect(await rls.asUser(OWN, (tx) => tx.select().from(s.defects))).toHaveLength(2);
    expect(await rls.asUser(PIL, (tx) => tx.select().from(s.defects))).toHaveLength(1);
    expect(await rls.asUser(OTH, (tx) => tx.select().from(s.defects))).toEqual([]);
  });

  it("blocks accepting and checking out while grounded", async () => {
    await rls.asUser(OWN, (tx) =>
      tx.update(s.aircraft).set({ status: "grounded" }).where(eq(s.aircraft.id, planeId)),
    );
    expect(
      await call(OWN, sql`select public.respond_to_booking(${requestId}::uuid, 'accept')`),
    ).toEqual({ error: "aircraft_grounded" });
    expect(await call(PIL, sql`select public.start_flight_log(${bookingId}::uuid)`)).toEqual({
      error: "aircraft_grounded",
    });
  });

  it("lets only the owner resolve a defect, once", async () => {
    const [first] = await rls.asUser(OWN, (tx) => tx.select().from(s.defects).limit(1));
    expect(await call(PIL, sql`select public.resolve_defect(${first!.id}::uuid, 'x')`)).toEqual({
      error: "not_found",
    });
    await call(OWN, sql`select public.resolve_defect(${first!.id}::uuid, 'Cowl resealed')`);
    expect(await call(OWN, sql`select public.resolve_defect(${first!.id}::uuid, 'again')`)).toEqual(
      { error: "already_resolved" },
    );
    // Listed again (the test aircraft skips the listing checks): bookings go ahead.
    await forceListed(planeId);
    expect(
      await call(OWN, sql`select public.respond_to_booking(${requestId}::uuid, 'accept')`),
    ).not.toHaveProperty("error");
  });
});
