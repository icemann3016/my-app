// Leg times are typed as clock times (HH:MM, UTC in the app) on a phone right after landing, in
// the order they happen: engine start ≤ block off < take-off < landing < block on ≤ engine stop.
// This turns them into instants, moving a time to the next day when the clock passed midnight,
// and checks the order (legTimeIssues).
import { addDays, zonedToUtc } from "./time";

export type LegClock = {
  /** Local date of block off at the departure airfield, YYYY-MM-DD. */
  date: string;
  fromZone: string;
  toZone: string;
  engineStart: string;
  blockOff: string;
  takeoff?: string | null;
  landing?: string | null;
  blockOn: string;
  engineStop: string;
};

export type LegInstants = {
  engineStart: Date;
  blockOff: Date;
  takeoffAt: Date | null;
  landingAt: Date | null;
  blockOn: Date;
  engineStop: Date;
};

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Null if a time is missing or not HH:MM. */
export function legTimesToUtc(leg: LegClock): LegInstants | null {
  const steps: [keyof LegInstants, string | null | undefined, string][] = [
    ["engineStart", leg.engineStart, leg.fromZone],
    ["blockOff", leg.blockOff, leg.fromZone],
    ["takeoffAt", leg.takeoff, leg.fromZone],
    ["landingAt", leg.landing, leg.toZone],
    ["blockOn", leg.blockOn, leg.toZone],
    ["engineStop", leg.engineStop, leg.toZone],
  ];
  const result: Partial<Record<keyof LegInstants, Date | null>> = {};
  let previous: Date | null = null;
  for (const [key, clock, zone] of steps) {
    const optional = key === "takeoffAt" || key === "landingAt";
    if (!clock) {
      if (!optional) return null;
      result[key] = null;
      continue;
    }
    if (!CLOCK.test(clock)) return null;
    // Start from the day of the previous time and move on a day if the clock went backwards.
    let day: string = previous ? localDayGuess(previous, zone) : leg.date;
    let instant = zonedToUtc(`${day}T${clock}`, zone);
    if (!instant) return null;
    if (previous && instant < previous) {
      day = addDays(day, 1);
      instant = zonedToUtc(`${day}T${clock}`, zone)!;
    }
    result[key] = instant;
    previous = instant;
  }
  return result as LegInstants;
}

/** The leg's time fields as the form names them, in the order they happen. */
export const LEG_TIME_FIELDS = [
  "engineStart",
  "blockOff",
  "takeoff",
  "landing",
  "blockOn",
  "engineStop",
] as const;
export type LegTimeField = (typeof LEG_TIME_FIELDS)[number];

const INSTANT_OF: Record<LegTimeField, keyof LegInstants> = {
  engineStart: "engineStart",
  blockOff: "blockOff",
  takeoff: "takeoffAt",
  landing: "landingAt",
  blockOn: "blockOn",
  engineStop: "engineStop",
};

/** Block off follows engine start and engine stop follows block on, possibly in the same minute;
 * everything else must be strictly later. */
const MAY_EQUAL = new Set<LegTimeField>(["blockOff", "engineStop"]);

/** A leg may pass midnight, but engine start to engine stop can't take longer than this. */
export const MAX_LEG_HOURS = 12;

export type LegTimeIssue = {
  /** The field to fix. */
  field: LegTimeField;
  /** "after": must be later than `other`; "notBefore": may equal `other` but not be earlier. */
  rule: "after" | "notBefore";
  other: LegTimeField;
};

/**
 * Times out of order. A clock that goes backwards was read as the next day, so a typo shows up
 * as a leg longer than MAX_LEG_HOURS: the field after the biggest gap is reported.
 */
export function legTimeIssues(t: LegInstants): LegTimeIssue[] {
  const present = LEG_TIME_FIELDS.flatMap((field) => {
    const at = t[INSTANT_OF[field]];
    return at ? [{ field, at: at.getTime() }] : [];
  });
  const issues: LegTimeIssue[] = [];
  let widest: { gap: number; issue: LegTimeIssue } | null = null;
  for (let i = 1; i < present.length; i++) {
    const prev = present[i - 1]!;
    const cur = present[i]!;
    const issue: LegTimeIssue = {
      field: cur.field,
      rule: MAY_EQUAL.has(cur.field) ? "notBefore" : "after",
      other: prev.field,
    };
    const gap = cur.at - prev.at;
    if (gap < 0 || (gap === 0 && issue.rule === "after")) issues.push(issue);
    if (!widest || gap > widest.gap) widest = { gap, issue };
  }
  const length = t.engineStop.getTime() - t.engineStart.getTime();
  if (!issues.length && widest && length > MAX_LEG_HOURS * 3_600_000) issues.push(widest.issue);
  return issues;
}

/** The local date of an instant in a zone. */
function localDayGuess(instant: Date, zone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: zone }).format(instant);
}
