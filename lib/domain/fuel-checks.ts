// Fuel and oil continuity across a flight log (BKG-13, BKG-14). Within a leg fuel only goes down
// (checked in the leg form); between legs (and between check-out and the first leg) it may only
// go up by what was recorded as added at that airfield. Readings are gauges and dipsticks, so
// small differences are ignored. Warnings, not blocks: the owner decides when confirming.

export const FUEL_TOLERANCE_L = 2;
export const OIL_TOLERANCE_L = 0.3;

type Readings = {
  fuelBeforeL: number | null;
  fuelAfterL: number | null;
  oilBeforeL: number | null;
  oilAfterL: number | null;
};

export type LegForChecks = Readings & { seq: number; fromIdent: string; toIdent: string };

export type UpliftForChecks = { kind: "fuel" | "oil"; airportIdent: string; quantityL: number };

export type ContinuityIssue =
  | {
      type: "rose";
      kind: "fuel" | "oil";
      /** The leg whose "before" reading is higher than the reading before it. */
      seq: number;
      airport: string;
      riseL: number;
      /** Litres of this kind recorded as added at that airfield. */
      recordedL: number;
    }
  | { type: "offRoute"; kind: "fuel" | "oil"; airport: string };

const round = (v: number) => Math.round(v * 10) / 10;

export function continuityIssues(
  checkout: { fuelStartL: number | null; oilStartL: number | null },
  legs: LegForChecks[],
  uplifts: UpliftForChecks[],
  departureIdent: string,
): ContinuityIssue[] {
  const issues: ContinuityIssue[] = [];
  const added = (kind: "fuel" | "oil", airport: string) =>
    uplifts
      .filter((u) => u.kind === kind && u.airportIdent === airport)
      .reduce((sum, u) => sum + u.quantityL, 0);
  const sorted = [...legs].sort((a, b) => a.seq - b.seq);
  sorted.forEach((leg, i) => {
    const prev = sorted[i - 1];
    for (const kind of ["fuel", "oil"] as const) {
      const before = kind === "fuel" ? leg.fuelBeforeL : leg.oilBeforeL;
      const earlier = prev
        ? kind === "fuel"
          ? prev.fuelAfterL
          : prev.oilAfterL
        : kind === "fuel"
          ? checkout.fuelStartL
          : checkout.oilStartL;
      if (before === null || earlier === null) continue;
      const rise = before - earlier;
      const recorded = added(kind, leg.fromIdent);
      const tolerance = kind === "fuel" ? FUEL_TOLERANCE_L : OIL_TOLERANCE_L;
      if (rise > recorded + tolerance) {
        issues.push({
          type: "rose",
          kind,
          seq: leg.seq,
          airport: leg.fromIdent,
          riseL: round(rise),
          recordedL: round(recorded),
        });
      }
    }
  });
  // Fuel or oil added after the last leg is fine, but it has to be somewhere the aircraft was.
  if (sorted.length) {
    const visited = new Set([departureIdent, ...sorted.flatMap((l) => [l.fromIdent, l.toIdent])]);
    const seen = new Set<string>();
    for (const u of uplifts) {
      const key = `${u.kind}:${u.airportIdent}`;
      if (visited.has(u.airportIdent) || seen.has(key)) continue;
      seen.add(key);
      issues.push({ type: "offRoute", kind: u.kind, airport: u.airportIdent });
    }
  }
  return issues;
}
