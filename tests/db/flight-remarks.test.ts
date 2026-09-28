import { eq, sql } from "drizzle-orm";
import { beforeAll, expect, it } from "vitest";

import { describeDb, forceListed, prepareDatabase } from "./setup";

let db: typeof import("@/lib/db");
let rls: typeof import("@/lib/db/rls");
let s: typeof import("@/lib/db/schema");

const OWN = "a1a1a1a1-1111-4111-8111-a1a1a1a1a1a1"; // owner
const PIL = "b2b2b2b2-2222-4222-8222-b2b2b2b2b2b2"; // pilot who writes the remarks
const NXT = "c3c3c3c3-3333-4333-8333-c3c3c3c3c3c3"; // a later renter
const OTH = "d4d4d4d4-4444-4444-8444-d4d4d4d4d4d4"; // someone else
let planeId: string;
let logId: string;

async function call<T>(user: string, query: ReturnType<typeof sql>) {
  try {
    return (await rls.asUser(user, (tx) => tx.execute(query))) as unknown as T[];
  } catch (e) {
    const err = e as { cause?: { code?: string; message?: string } };
    return { error: err.cause?.code === "P0001" ? err.cause.message : err.cause?.code };
  }
}

const at = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();
const knownItems = (user: string) =>
  call<{ id: string; body: string }>(
    user,
    sql`select * from public.known_items_for_aircraft(${planeId}::uuid)`,
  );

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

describeDb("flight remarks and known items", () => {
  beforeAll(async () => {
    await prepareDatabase();
    db = await import("@/lib/db");
    rls = await import("@/lib/db/rls");
    s = await import("@/lib/db/schema");
    const owner = db.getDb();
    await owner.insert(s.users).values([
      { id: OWN, name: "Own", email: "own-r@example.com" },
      { id: PIL, name: "Pil", email: "pil-r@example.com" },
      { id: NXT, name: "Nxt", email: "nxt-r@example.com" },
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
        registration: "LZ-REM",
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
    const bookingId = await request(PIL, 60, 240);
    await rls.asUser(OWN, (tx) =>
      tx.execute(sql`select public.respond_to_booking(${bookingId}::uuid, 'accept')`),
    );
    const [started] = (await rls.asUser(PIL, (tx) =>
      tx.execute(sql`select public.start_flight_log(${bookingId}::uuid) as id`),
    )) as unknown as { id: string }[];
    logId = started!.id;
  }, 60_000);

  it("lets the pilot add remarks that the owner sees, and nobody else", async () => {
    const remark = (kind: "aircraft" | "weather", body: string) => ({
      flightLogId: logId,
      aircraftId: sql`null`, // filled in by the trigger
      kind,
      body,
    });
    await rls.asUser(PIL, (tx) =>
      tx
        .insert(s.flightRemarks)
        .values([
          remark("aircraft", "Left mag drop 150 rpm"),
          remark("weather", "Strong crosswind at LBSF"),
        ]),
    );
    const rows = await rls.asUser(OWN, (tx) => tx.select().from(s.flightRemarks));
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.aircraftId === planeId)).toBe(true);
    expect(await rls.asUser(OTH, (tx) => tx.select().from(s.flightRemarks))).toEqual([]);
    const byOwner = await rls
      .asUser(OWN, (tx) => tx.insert(s.flightRemarks).values(remark("aircraft", "x")))
      .then(
        () => "inserted",
        (e: { cause?: { code?: string } }) => e.cause?.code,
      );
    expect(byOwner).toBe("42501");
  });

  it("lets only the owner mark aircraft remarks as known items", async () => {
    const rows = await rls.asUser(OWN, (tx) => tx.select().from(s.flightRemarks));
    const mag = rows.find((r) => r.kind === "aircraft")!;
    const wx = rows.find((r) => r.kind === "weather")!;
    expect(await call(PIL, sql`select public.set_known_item(${mag.id}::uuid, 'known')`)).toEqual({
      error: "not_found",
    });
    expect(await call(OWN, sql`select public.set_known_item(${wx.id}::uuid, 'known')`)).toEqual({
      error: "not_aircraft",
    });
    expect(await call(OWN, sql`select public.set_known_item(${mag.id}::uuid, 'resolved')`)).toEqual(
      { error: "bad_state" },
    );
    await call(OWN, sql`select public.set_known_item(${mag.id}::uuid, 'known')`);
    // A known item stays: the pilot can't delete it any more.
    const deleted = await rls.asUser(PIL, (tx) =>
      tx.delete(s.flightRemarks).where(eq(s.flightRemarks.id, mag.id)).returning(),
    );
    expect(deleted).toEqual([]);
  });

  it("shows open known items to later renters with a booking, without the author", async () => {
    expect(await knownItems(NXT)).toEqual([]);
    await request(NXT, 60 * 24 * 3, 60 * 24 * 3 + 120);
    const items = (await knownItems(NXT)) as { id: string; body: string }[];
    expect(items.map((i) => i.body)).toEqual(["Left mag drop 150 rpm"]);
    expect(Object.keys(items[0]!).sort()).toEqual(["body", "id", "known_since"]);
    expect(await knownItems(OTH)).toEqual([]);

    await call(OWN, sql`select public.set_known_item(${items[0]!.id}::uuid, 'resolved')`);
    expect(await knownItems(NXT)).toEqual([]);
  });
});
