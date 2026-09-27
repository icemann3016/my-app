import { eq, sql } from "drizzle-orm";
import { beforeAll, expect, it } from "vitest";

import { describeDb, forceListed, prepareDatabase } from "./setup";

let db: typeof import("@/lib/db");
let rls: typeof import("@/lib/db/rls");
let s: typeof import("@/lib/db/schema");
let search: typeof import("@/lib/aircraft/search");
let parse: typeof import("@/lib/validation/search").parseSearch;

const TOM = "abababab-dddd-4ddd-8ddd-dddddddddddd"; // owner
const UMA = "cdcdcdcd-eeee-4eee-8eee-eeeeeeeeeeee"; // pilot
let aircraftId: string;
const SOFIA = { lat: 42.6952, lon: 23.4062 };
const TROMSO = { lat: 69.68, lon: 18.94 };

const needsNight = async (from: string, to: string, at = SOFIA) => {
  const [row] = (await db
    .getDb()
    .execute(
      sql`select public.period_needs_night(${`[${from},${to})`}::tstzrange, ${at.lat}, ${at.lon}) as night`,
    )) as unknown as { night: boolean }[];
  return row!.night;
};
const mine = async (period: string) =>
  (
    (await rls.asUser(UMA, (tx) =>
      tx.execute(
        sql`select * from public.my_eligibility(${aircraftId}::uuid, ${period}::tstzrange)`,
      ),
    )) as unknown as { requirement: string; blocking: boolean }[]
  ).map((f) => `${f.requirement}${f.blocking ? "" : " (info)"}`);

describeDb("night flights", () => {
  beforeAll(async () => {
    await prepareDatabase();
    db = await import("@/lib/db");
    rls = await import("@/lib/db/rls");
    s = await import("@/lib/db/schema");
    search = await import("@/lib/aircraft/search");
    parse = (await import("@/lib/validation/search")).parseSearch;
    const owner = db.getDb();
    await owner.insert(s.users).values([
      { id: TOM, name: "Tom", email: "tom@example.com" },
      { id: UMA, name: "Uma", email: "uma@example.com" },
    ]);
    await owner.insert(s.airports).values({
      ident: "LBSF",
      type: "large_airport",
      name: "Sofia",
      icaoCode: "LBSF",
      country: "BG",
      latitude: SOFIA.lat,
      longitude: SOFIA.lon,
      timezone: "Europe/Sofia",
    });
    const [plane] = await owner
      .insert(s.aircraft)
      .values({
        ownerId: TOM,
        registration: "LZ-NIT",
        manufacturer: "Cessna",
        model: "172",
        typeDesignator: "C172",
        seats: 4,
        fuelType: "avgas_100ll",
        homeAirportIdent: "LBSF",
        pricePerHour: 150,
      })
      .returning();
    aircraftId = plane!.id;
    await forceListed(aircraftId);
    await owner.insert(s.pilotLicences).values({
      userId: UMA,
      type: "ppl_a",
      issuingState: "BG",
      number: "1",
      status: "verified",
    });
    await owner.insert(s.medicals).values({
      userId: UMA,
      class: "class2",
      issuingState: "BG",
      validUntil: "2099-01-01",
      status: "verified",
    });
    await owner
      .insert(s.pilotRatings)
      .values({ userId: UMA, kind: "class", code: "SEP_LAND", status: "verified" });
  }, 60_000);

  it("works out sunrise and sunset", async () => {
    const [dec] = (await db
      .getDb()
      .execute(
        sql`select sunrise, sunset from public.sun_times('2026-12-21', ${SOFIA.lat}, ${SOFIA.lon})`,
      )) as unknown as { sunrise: string; sunset: string }[];
    // Sofia, 21 December: sunrise about 07:55, sunset about 16:57 local (UTC+2).
    const minutes = (v: string) => {
      const d = new Date(v);
      return d.getUTCHours() * 60 + d.getUTCMinutes();
    };
    expect(Math.abs(minutes(dec!.sunrise) - (5 * 60 + 55))).toBeLessThanOrEqual(5);
    expect(Math.abs(minutes(dec!.sunset) - (14 * 60 + 57))).toBeLessThanOrEqual(5);
  });

  it("counts from 30 minutes after sunset to 30 minutes before sunrise as night", async () => {
    // Sunset in Sofia on 21 Dec is about 14:56 UTC, so night starts about 15:26 UTC.
    expect(await needsNight("2026-12-21T12:00:00Z", "2026-12-21T15:00:00Z")).toBe(false);
    expect(await needsNight("2026-12-21T15:00:00Z", "2026-12-21T15:20:00Z")).toBe(false);
    expect(await needsNight("2026-12-21T15:00:00Z", "2026-12-21T16:00:00Z")).toBe(true);
    // Sunrise about 05:54 UTC: night until about 05:24 UTC.
    expect(await needsNight("2026-12-22T05:00:00Z", "2026-12-22T06:00:00Z")).toBe(true);
    expect(await needsNight("2026-12-22T05:40:00Z", "2026-12-22T09:00:00Z")).toBe(false);
    // A multi-day rental always spans a night.
    expect(await needsNight("2026-06-20T08:00:00Z", "2026-06-22T08:00:00Z")).toBe(true);
  });

  it("handles polar night and midnight sun", async () => {
    expect(await needsNight("2026-12-21T11:00:00Z", "2026-12-21T12:00:00Z", TROMSO)).toBe(true);
    expect(await needsNight("2026-06-21T22:00:00Z", "2026-06-22T02:00:00Z", TROMSO)).toBe(false);
  });

  it("needs a night-approved aircraft and a Night rating for night rentals", async () => {
    const day = "[2026-12-21T09:00:00Z,2026-12-21T12:00:00Z)";
    const evening = "[2026-12-21T14:00:00Z,2026-12-21T17:00:00Z)";
    expect(await mine(day)).toEqual([]);
    expect(await mine(evening)).toEqual(["aircraft_no_night"]);

    await db
      .getDb()
      .update(s.aircraft)
      .set({ nightVfr: true })
      .where(eq(s.aircraft.id, aircraftId));
    expect(await mine(evening)).toEqual(["night_rating"]);

    await db
      .getDb()
      .insert(s.pilotRatings)
      .values({ userId: UMA, kind: "privilege", code: "NIGHT", status: "verified" });
    expect(await mine(evening)).toEqual(["night_flight (info)"]);
  });

  it("hides aircraft without night VFR from night searches", async () => {
    await db
      .getDb()
      .update(s.aircraft)
      .set({ nightVfr: false })
      .where(eq(s.aircraft.id, aircraftId));
    const regs = async (from: string, to: string) =>
      (
        await search.searchAircraft(null, parse({ airport: "LBSF", radius: "25", from, to }))
      ).results.map((r) => r.registration);
    // Local time in Sofia (UTC+2 in winter): 11:00–13:00 is day, 17:00–19:00 is night.
    expect(await regs("2026-12-21T11:00", "2026-12-21T13:00")).toEqual(["LZ-NIT"]);
    expect(await regs("2026-12-21T17:00", "2026-12-21T19:00")).toEqual([]);
  });
});
