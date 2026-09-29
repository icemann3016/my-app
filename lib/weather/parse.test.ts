import { describe, expect, it } from "vitest";

import { belowVfr, parseMetar, parseTaf, tafWarnings } from "./parse";

describe("METAR", () => {
  it("reads visibility and ceiling", () => {
    expect(parseMetar("METAR LBSF 290600Z 11004KT 9999 FEW030 BKN080 12/08 Q1018 NOSIG")).toEqual({
      visibilityM: 10_000,
      ceilingFt: 8000,
    });
    expect(parseMetar("METAR LBSF 290600Z 00000KT CAVOK 10/05 Q1020")).toEqual({
      visibilityM: 10_000,
      ceilingFt: null,
    });
    expect(parseMetar("METAR LBWN 290600Z 09005KT 3000 BR OVC007 14/13 Q1015")).toEqual({
      visibilityM: 3000,
      ceilingFt: 700,
    });
    expect(parseMetar("METAR LBPD 290600Z 00000KT 0200 FG VV001 08/08 Q1022").ceilingFt).toBe(100);
    // The trend doesn't count as the current observation.
    expect(
      parseMetar("METAR LBSF 290600Z 27010KT 9999 SCT040 15/05 Q1012 TEMPO 3000 SHRA"),
    ).toEqual({ visibilityM: 10_000, ceilingFt: null });
  });

  it("uses EASA VFR minima: 5 km and 1 500 ft", () => {
    expect(belowVfr({ visibilityM: 5000, ceilingFt: 1500 })).toBe(false);
    expect(belowVfr({ visibilityM: 4999 })).toBe(true);
    expect(belowVfr({ ceilingFt: 1400 })).toBe(true);
    expect(belowVfr({ visibilityM: 10_000, ceilingFt: null })).toBe(false);
  });
});

describe("TAF", () => {
  const issued = new Date("2026-09-29T05:00:00Z");
  const raw =
    "TAF LBSF 290500Z 2906/3006 VRB03KT 9999 FEW030 TEMPO 2912/2918 4000 SHRA BKN012 " +
    "BECMG 2920/2922 27010KT PROB30 TEMPO 3002/3006 0800 FG FM300400 18005KT CAVOK=";

  it("splits the forecast into timed periods", () => {
    const periods = parseTaf(raw, issued);
    expect(periods.map((p) => [p.kind, p.from.toISOString(), p.to.toISOString()])).toEqual([
      ["base", "2026-09-29T06:00:00.000Z", "2026-09-30T04:00:00.000Z"],
      ["temporary", "2026-09-29T12:00:00.000Z", "2026-09-29T18:00:00.000Z"],
      ["becoming", "2026-09-29T20:00:00.000Z", "2026-09-30T06:00:00.000Z"],
      ["probable", "2026-09-30T02:00:00.000Z", "2026-09-30T06:00:00.000Z"],
      ["from", "2026-09-30T04:00:00.000Z", "2026-09-30T06:00:00.000Z"],
    ]);
    expect(periods[1]).toMatchObject({ visibilityM: 4000, ceilingFt: 1200 });
    expect(periods[3]).toMatchObject({ probability: 30, visibilityM: 800 });
    expect(periods[2]!.visibilityM).toBeUndefined(); // BECMG only changes the wind
  });

  it("warns only about periods that overlap the flight", () => {
    const periods = parseTaf(raw, issued);
    const morning = tafWarnings(
      periods,
      new Date("2026-09-29T07:00Z"),
      new Date("2026-09-29T10:00Z"),
    );
    expect(morning).toEqual([]);
    const afternoon = tafWarnings(
      periods,
      new Date("2026-09-29T13:00Z"),
      new Date("2026-09-29T15:00Z"),
    );
    expect(afternoon.map((p) => p.kind)).toEqual(["temporary"]);
  });

  it("rolls validity over the end of the month", () => {
    const periods = parseTaf(
      "TAF LBSF 301700Z 3018/0118 9999 SCT030",
      new Date("2026-09-30T17:00Z"),
    );
    expect(periods[0]!.to.toISOString()).toBe("2026-10-01T18:00:00.000Z");
  });
});
