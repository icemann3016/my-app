// Leg times are typed as local clock times (HH:MM) on a phone right after landing: departure
// times in the departure airfield's zone, arrival times in the arrival airfield's zone. This
// turns them into UTC instants, moving a time to the next day when the clock passed midnight.
import { addDays, zonedToUtc } from "./time";

export type LegClock = {
  /** Local date of block off at the departure airfield, YYYY-MM-DD. */
  date: string;
  fromZone: string;
  toZone: string;
  blockOff: string;
  engineStart: string;
  takeoff?: string | null;
  landing?: string | null;
  engineStop: string;
  blockOn: string;
};

export type LegInstants = {
  blockOff: Date;
  engineStart: Date;
  takeoffAt: Date | null;
  landingAt: Date | null;
  engineStop: Date;
  blockOn: Date;
};

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Null if a time is missing or not HH:MM. */
export function legTimesToUtc(leg: LegClock): LegInstants | null {
  const steps: [keyof LegInstants, string | null | undefined, string][] = [
    ["blockOff", leg.blockOff, leg.fromZone],
    ["engineStart", leg.engineStart, leg.fromZone],
    ["takeoffAt", leg.takeoff, leg.fromZone],
    ["landingAt", leg.landing, leg.toZone],
    ["engineStop", leg.engineStop, leg.toZone],
    ["blockOn", leg.blockOn, leg.toZone],
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

/** The local date of an instant in a zone. */
function localDayGuess(instant: Date, zone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: zone }).format(instant);
}
