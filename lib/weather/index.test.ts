import { describe, expect, it } from "vitest";

import { bookingWeather, distanceKm, type Fetcher, reportTime } from "./index";

const now = new Date("2026-09-29T06:10:00Z");
const sofia = { ident: "LBSF", code: "LBSF", name: "Sofia", latitude: 42.695, longitude: 23.406 };
const lesnovo = {
  ident: "BG-0004",
  code: "BG-0004",
  name: "Lesnovo",
  latitude: 42.638,
  longitude: 23.645,
};

const reports: Record<string, { icaoId: string; lat: number; lon: number; raw: string }[]> = {
  metar: [
    {
      icaoId: "LBSF",
      lat: 42.695,
      lon: 23.406,
      raw: "METAR LBSF 290600Z 09005KT 3000 BR OVC007 14/13 Q1015",
    },
  ],
  taf: [
    {
      icaoId: "LBSF",
      lat: 42.695,
      lon: 23.406,
      raw: "TAF LBSF 290500Z 2906/3006 VRB03KT 9999 FEW030 TEMPO 2912/2918 4000 SHRA BKN012",
    },
  ],
};

/** A fake weather API: answers ids= and bbox= queries from the reports above. */
const fake: Fetcher = async (path) => {
  const [kind] = path.split("?") as ["metar" | "taf"];
  const rows = reports[kind]!.map((r) => ({
    icaoId: r.icaoId,
    lat: r.lat,
    lon: r.lon,
    [kind === "metar" ? "rawOb" : "rawTAF"]: r.raw,
  }));
  const ids = path.match(/ids=([A-Z0-9]+)/)?.[1];
  return ids ? rows.filter((r) => r.icaoId === ids) : rows;
};

describe("booking weather", () => {
  it("waits until 30 hours before departure", async () => {
    const w = await bookingWeather(
      [sofia],
      { from: new Date("2026-10-01T08:00Z"), to: new Date("2026-10-01T10:00Z") },
      now,
      fake,
    );
    expect(w).toEqual({ stage: "later", showsAt: new Date("2026-09-30T02:00Z") });
  });

  it("warns from the TAF for the booked time only", async () => {
    const morning = await bookingWeather(
      [sofia],
      // More than 3 h ahead: only the TAF counts, not today's foggy METAR.
      { from: new Date("2026-09-29T09:30Z"), to: new Date("2026-09-29T11:30Z") },
      now,
      fake,
    );
    expect(morning).toMatchObject({ stage: "now", below: false });
    const afternoon = await bookingWeather(
      [sofia],
      { from: new Date("2026-09-29T13:00Z"), to: new Date("2026-09-29T15:00Z") },
      now,
      fake,
    );
    expect(afternoon).toMatchObject({ stage: "now", below: true });
  });

  it("adds the METAR close to departure and uses the nearest station within 50 km", async () => {
    const w = await bookingWeather(
      [lesnovo, sofia],
      { from: new Date("2026-09-29T07:00Z"), to: new Date("2026-09-29T09:00Z") },
      now,
      fake,
    );
    if (w.stage !== "now") throw new Error(w.stage);
    expect(w.below).toBe(true); // 3 000 m and OVC007 right now
    expect(w.fields[0]!.metar).toMatchObject({ station: "LBSF", below: true });
    expect(w.fields[0]!.metar!.distanceKm).toBeGreaterThan(15);
    expect(w.fields[1]!.metar!.distanceKm).toBeNull();
  });

  it("says when no report is near, and when the service is down", async () => {
    const far = { ...lesnovo, latitude: 44.5, longitude: 26.1 };
    const w = await bookingWeather(
      [far],
      { from: new Date("2026-09-29T07:00Z"), to: new Date("2026-09-29T09:00Z") },
      now,
      fake,
    );
    expect(w).toMatchObject({ stage: "now", fields: [{ metar: null, taf: null }] });
    const down = await bookingWeather(
      [sofia],
      { from: new Date("2026-09-29T07:00Z"), to: new Date("2026-09-29T09:00Z") },
      now,
      async () => null,
    );
    expect(down).toMatchObject({ stage: "now", unavailable: true, below: false });
  });

  it("reads report times and distances", () => {
    expect(reportTime("METAR LBSF 290600Z 9999", now)?.toISOString()).toBe(
      "2026-09-29T06:00:00.000Z",
    );
    expect(
      reportTime("METAR LBSF 302350Z 9999", new Date("2026-10-01T00:10Z"))?.toISOString(),
    ).toBe("2026-09-30T23:50:00.000Z");
    expect(Math.round(distanceKm(42.695, 23.406, 42.638, 23.645))).toBe(21);
  });
});
