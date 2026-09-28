// Aircraft usage from confirmed flight logs (BKG-16): hours, landings, fuel and oil, per month
// and per pilot. Fuel and oil used per leg = on board before − after (only when both are known);
// oil use per engine hour counts only legs with oil readings, so gaps don't lower the figure.
import { utcToZoned } from "./time";

export type UsageLeg = {
  blockOff: Date;
  blockOn: Date;
  engineStart: Date;
  engineStop: Date;
  landings: number;
  fuelBeforeL: number | null;
  fuelAfterL: number | null;
  oilBeforeL: number | null;
  oilAfterL: number | null;
};

export type UsageFlight = {
  bookingId: string;
  pilotId: string | null;
  /** Flown time on the aircraft's time basis, as confirmed by the owner. */
  flownMinutes: number;
  legs: UsageLeg[];
};

export type UsageTotals = {
  flights: number;
  flownMinutes: number;
  blockMinutes: number;
  engineMinutes: number;
  landings: number;
  fuelUsedL: number;
  oilUsedL: number;
  /** Litres of oil per engine hour, or null without oil readings. */
  oilPerEngineHourL: number | null;
};

const minutes = (from: Date, to: Date) => Math.max(0, (to.getTime() - from.getTime()) / 60_000);
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Totals of some flights. */
export function usageTotals(flights: UsageFlight[]): UsageTotals {
  let blockMinutes = 0;
  let engineMinutes = 0;
  let landings = 0;
  let fuelUsedL = 0;
  let oilUsedL = 0;
  let oilEngineMinutes = 0;
  for (const flight of flights) {
    for (const leg of flight.legs) {
      const engine = minutes(leg.engineStart, leg.engineStop);
      blockMinutes += minutes(leg.blockOff, leg.blockOn);
      engineMinutes += engine;
      landings += leg.landings;
      if (leg.fuelBeforeL !== null && leg.fuelAfterL !== null) {
        fuelUsedL += Math.max(0, leg.fuelBeforeL - leg.fuelAfterL);
      }
      if (leg.oilBeforeL !== null && leg.oilAfterL !== null) {
        oilUsedL += Math.max(0, leg.oilBeforeL - leg.oilAfterL);
        oilEngineMinutes += engine;
      }
    }
  }
  return {
    flights: flights.length,
    flownMinutes: flights.reduce((sum, f) => sum + f.flownMinutes, 0),
    blockMinutes: Math.round(blockMinutes),
    engineMinutes: Math.round(engineMinutes),
    landings,
    fuelUsedL: round1(fuelUsedL),
    oilUsedL: round1(oilUsedL),
    oilPerEngineHourL:
      oilEngineMinutes > 0 ? Math.round((oilUsedL / (oilEngineMinutes / 60)) * 100) / 100 : null,
  };
}

/** Flights grouped by the local month ("2026-10") of their first block off, newest first. */
export function usageByMonth(flights: UsageFlight[], timeZone: string) {
  const groups = new Map<string, UsageFlight[]>();
  for (const flight of flights) {
    const first = flight.legs[0];
    if (!first) continue;
    const month = utcToZoned(first.blockOff, timeZone).slice(0, 7);
    groups.set(month, [...(groups.get(month) ?? []), flight]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, group]) => ({ month, ...usageTotals(group) }));
}

/** Flights grouped by pilot (null: deleted account), most flown time first. */
export function usageByPilot(flights: UsageFlight[]) {
  const groups = new Map<string | null, UsageFlight[]>();
  for (const flight of flights) {
    groups.set(flight.pilotId, [...(groups.get(flight.pilotId) ?? []), flight]);
  }
  return [...groups.entries()]
    .map(([pilotId, group]) => ({ pilotId, ...usageTotals(group) }))
    .sort((a, b) => b.flownMinutes - a.flownMinutes);
}
