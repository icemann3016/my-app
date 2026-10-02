import { describe, expect, it } from "vitest";

import { continuityIssues, type LegForChecks } from "./fuel-checks";

const leg = (seq: number, from: string, to: string, r: Partial<LegForChecks> = {}) => ({
  seq,
  fromIdent: from,
  toIdent: to,
  fuelBeforeL: null,
  fuelAfterL: null,
  oilBeforeL: null,
  oilAfterL: null,
  ...r,
});

describe("fuel and oil continuity", () => {
  const checkout = { fuelStartL: 100, oilStartL: 6 };

  it("accepts readings that only go up by what was added", () => {
    const legs = [
      leg(1, "LBSF", "LBPD", { fuelBeforeL: 100, fuelAfterL: 70, oilBeforeL: 6, oilAfterL: 5.8 }),
      leg(2, "LBPD", "LBSF", {
        fuelBeforeL: 130,
        fuelAfterL: 100,
        oilBeforeL: 6.7,
        oilAfterL: 6.6,
      }),
    ];
    const uplifts = [
      { kind: "fuel" as const, airportIdent: "LBPD", quantityL: 60 },
      { kind: "oil" as const, airportIdent: "LBPD", quantityL: 0.9 },
      // After the last leg, back at base
      { kind: "fuel" as const, airportIdent: "LBSF", quantityL: 40 },
    ];
    expect(continuityIssues(checkout, legs, uplifts, "LBSF")).toEqual([]);
  });

  it("ignores small gauge differences", () => {
    const legs = [leg(1, "LBSF", "LBSF", { fuelBeforeL: 101.5, oilBeforeL: 6.2 })];
    expect(continuityIssues(checkout, legs, [], "LBSF")).toEqual([]);
  });

  it("flags fuel or oil that went up without (enough) recorded refuelling", () => {
    const legs = [
      leg(1, "LBSF", "LBPD", { fuelBeforeL: 100, fuelAfterL: 70, oilAfterL: 5.8 }),
      leg(2, "LBPD", "LBSF", { fuelBeforeL: 130, oilBeforeL: 6.8 }),
    ];
    const uplifts = [{ kind: "fuel" as const, airportIdent: "LBPD", quantityL: 20 }];
    expect(continuityIssues(checkout, legs, uplifts, "LBSF")).toEqual([
      { type: "rose", kind: "fuel", seq: 2, airport: "LBPD", riseL: 60, recordedL: 20 },
      { type: "rose", kind: "oil", seq: 2, airport: "LBPD", riseL: 1, recordedL: 0 },
    ]);
  });

  it("checks the first leg against the check-out readings", () => {
    const legs = [leg(1, "LBSF", "LBSF", { fuelBeforeL: 150 })];
    expect(continuityIssues(checkout, legs, [], "LBSF")).toEqual([
      { type: "rose", kind: "fuel", seq: 1, airport: "LBSF", riseL: 50, recordedL: 0 },
    ]);
    const refuelled = [{ kind: "fuel" as const, airportIdent: "LBSF", quantityL: 50 }];
    expect(continuityIssues(checkout, legs, refuelled, "LBSF")).toEqual([]);
  });

  it("flags fuel or oil added at an airfield the aircraft never visited", () => {
    const legs = [leg(1, "LBSF", "LBPD")];
    const uplifts = [
      { kind: "fuel" as const, airportIdent: "LBWN", quantityL: 30 },
      { kind: "fuel" as const, airportIdent: "LBWN", quantityL: 10 },
    ];
    expect(continuityIssues(checkout, legs, uplifts, "LBSF")).toEqual([
      { type: "offRoute", kind: "fuel", airport: "LBWN" },
    ]);
  });
});
