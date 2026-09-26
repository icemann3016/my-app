import { readFileSync } from "node:fs";
import path from "node:path";

import { parse } from "csv-parse/sync";
import { describe, expect, it } from "vitest";

import { shouldImport, toAirportRow } from "./transform.mjs";

const records: Record<string, string>[] = parse(
  readFileSync(path.join(import.meta.dirname, "../../tests/fixtures/airports.csv")),
  { columns: true },
);

describe("airport import", () => {
  it("keeps European airfields and skips heliports, closed fields and other continents", () => {
    const kept = records.filter((r) => shouldImport(r)).map((r) => r.ident);
    expect(kept).toContain("LBSF");
    expect(kept).toContain("BG-0004"); // small airfield without ICAO code
    expect(kept).not.toContain("AD-0001"); // heliport
    expect(kept).not.toContain("AD-0002"); // closed
    expect(kept).not.toContain("KJFK"); // North America
  });

  it("maps a record to a table row with a time zone", () => {
    const sofia = records.find((r) => r.ident === "LBSF")!;
    const row = toAirportRow(sofia, () => "Europe/Sofia");
    expect(row).toMatchObject({
      ident: "LBSF",
      icao_code: "LBSF",
      iata_code: "SOF",
      country: "BG",
      municipality: "Sofia",
      timezone: "Europe/Sofia",
    });
    expect(row.latitude).toBeCloseTo(42.69, 1);
    expect(Number.isInteger(row.elevation_ft)).toBe(true);
  });

  it("turns empty fields into null", () => {
    const strip = records.find((r) => r.ident === "BG-0004")!;
    const row = toAirportRow(strip, () => "Europe/Sofia");
    expect(row.icao_code).toBeNull();
    expect(row.iata_code).toBeNull();
  });
});
