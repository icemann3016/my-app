import { beforeAll, expect, it } from "vitest";

import { describeDb, forceListed, prepareDatabase } from "./setup";

let db: typeof import("@/lib/db");
let s: typeof import("@/lib/db/schema");
let search: typeof import("@/lib/aircraft/search");
let parse: typeof import("@/lib/validation/search").parseSearch;

const RIA = "8b8b8b8b-bbbb-4bbb-8bbb-bbbbbbbbbbbb"; // owner
const SAM = "9c9c9c9c-cccc-4ccc-8ccc-cccccccccccc"; // verified pilot
const ids: Record<string, string> = {};

const airport = (ident: string, name: string, latitude: number, longitude: number) => ({
  ident,
  type: "medium_airport",
  name,
  icaoCode: ident,
  country: "BG",
  latitude,
  longitude,
  timezone: "Europe/Sofia",
});

describeDb("aircraft search", () => {
  beforeAll(async () => {
    await prepareDatabase();
    db = await import("@/lib/db");
    s = await import("@/lib/db/schema");
    search = await import("@/lib/aircraft/search");
    parse = (await import("@/lib/validation/search")).parseSearch;
    const owner = db.getDb();
    await owner.insert(s.users).values([
      { id: RIA, name: "Ria", email: "ria@example.com" },
      { id: SAM, name: "Sam", email: "sam@example.com" },
    ]);
    await owner
      .insert(s.airports)
      .values([
        airport("LBSF", "Sofia", 42.6952, 23.4062),
        airport("LBPD", "Plovdiv", 42.0678, 24.8508),
        airport("LBWN", "Varna", 43.2321, 27.8251),
      ]);
    const planes = [
      {
        registration: "LZ-SOF",
        homeAirportIdent: "LBSF",
        pricePerHour: 200,
        category: "aeroplane",
      },
      {
        registration: "LZ-PDV",
        homeAirportIdent: "LBPD",
        pricePerHour: 150,
        category: "aeroplane",
      },
      {
        registration: "LZ-VAR",
        homeAirportIdent: "LBWN",
        pricePerHour: 90,
        category: "ultralight",
      },
    ] as const;
    for (const p of planes) {
      const [row] = await owner
        .insert(s.aircraft)
        .values({
          ...p,
          ownerId: RIA,
          manufacturer: "Cessna",
          model: "172",
          typeDesignator: "C172",
          seats: p.category === "ultralight" ? 2 : 4,
          fuelType: "avgas_100ll",
        })
        .returning();
      ids[p.registration] = row!.id;
      await forceListed(row!.id);
    }
    // A draft is never found.
    await owner.insert(s.aircraft).values({
      ownerId: RIA,
      registration: "LZ-DRF",
      manufacturer: "Cessna",
      model: "172",
      typeDesignator: "C172",
      seats: 4,
      fuelType: "avgas_100ll",
      homeAirportIdent: "LBSF",
    });
    // Sam can fly aeroplanes; ultralights have no automatic class rating.
    await owner.insert(s.pilotLicences).values({
      userId: SAM,
      type: "ppl_a",
      issuingState: "BG",
      number: "1",
      status: "verified",
    });
    await owner.insert(s.medicals).values({
      userId: SAM,
      class: "class2",
      issuingState: "BG",
      validUntil: "2099-01-01",
      status: "verified",
    });
    await owner
      .insert(s.rentalRequirements)
      .values({ aircraftId: ids["LZ-SOF"]!, minTotalHours: 500 });
  }, 60_000);

  const regs = async (params: Record<string, string>, viewer: string | null = null) =>
    (await search.searchAircraft(viewer, parse(params))).results.map((r) => r.registration);

  it("finds listed aircraft near an airport, nearest first", async () => {
    expect(await regs({ airport: "LBSF", radius: "100" })).toEqual(["LZ-SOF"]);
    expect(await regs({ airport: "LBSF", radius: "200" })).toEqual(["LZ-SOF", "LZ-PDV"]);
    expect(await regs({ airport: "LBWN", radius: "500" })).toEqual(["LZ-VAR", "LZ-PDV", "LZ-SOF"]);
    const [first] = (await search.searchAircraft(null, parse({ airport: "LBSF", radius: "200" })))
      .results;
    expect(first!.distanceKm).toBe(0);
  });

  it("filters by category, seats, price and sorts by price", async () => {
    expect(await regs({ category: "ultralight" })).toEqual(["LZ-VAR"]);
    expect(await regs({ seats: "4", sort: "price" })).toEqual(["LZ-PDV", "LZ-SOF"]);
    expect(await regs({ maxPrice: "160", sort: "price" })).toEqual(["LZ-VAR", "LZ-PDV"]);
  });

  it("only shows aircraft that are free for the whole period", async () => {
    await db.getDb().insert(s.calendarEntries).values({
      aircraftId: ids["LZ-PDV"]!,
      kind: "maintenance",
      period: "[2030-06-01T06:00:00Z,2030-06-01T10:00:00Z)",
    });
    // 11:00–12:00 local in Sofia (UTC+3 in summer) = 08:00–09:00 UTC: overlaps.
    expect(
      await regs({
        airport: "LBSF",
        radius: "200",
        from: "2030-06-01T11:00",
        to: "2030-06-01T12:00",
      }),
    ).toEqual(["LZ-SOF"]);
    expect(
      await regs({
        airport: "LBSF",
        radius: "200",
        from: "2030-06-01T13:00",
        to: "2030-06-01T15:00",
      }),
    ).toEqual(["LZ-SOF", "LZ-PDV"]);
  });

  it("can show only aircraft the pilot may rent", async () => {
    // Without a class rating only the ultralight is open (no automatic class rating there).
    expect(await regs({ sort: "price", eligible: "1" }, SAM)).toEqual(["LZ-VAR"]);
    await db.getDb().insert(s.pilotRatings).values({
      userId: SAM,
      kind: "class",
      code: "SEP_LAND",
      status: "verified",
    });
    // LZ-SOF needs 500 h; ultralights have no automatic class rating.
    expect(await regs({ sort: "price", eligible: "1" }, SAM)).toEqual(["LZ-VAR", "LZ-PDV"]);
    // Visitors can't use the filter; they see everything.
    expect(await regs({ sort: "price", eligible: "1" })).toHaveLength(3);
  });
});
