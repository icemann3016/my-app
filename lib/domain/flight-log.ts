// Flown time and amount due of a rental (BKG-7, plan §4.8): the one function both pilot and
// owner see before the log is confirmed.
import { estimatePrice } from "./pricing";

export type TimeBasis = "hobbs" | "tach" | "block";

export type LegForTime = {
  blockOff: Date;
  blockOn: Date;
  hobbsStart: number | null;
  hobbsEnd: number | null;
  tachStart: number | null;
  tachEnd: number | null;
};

/**
 * Minutes flown on the aircraft's time basis: Σ(meter end − start) for Hobbs or tach, Σ(block on
 * − block off) for block time. Null when a meter reading is missing.
 */
export function flownMinutes(legs: LegForTime[], basis: TimeBasis): number | null {
  let total = 0;
  for (const leg of legs) {
    if (basis === "block") {
      total += (leg.blockOn.getTime() - leg.blockOff.getTime()) / 60_000;
      continue;
    }
    const start = basis === "hobbs" ? leg.hobbsStart : leg.tachStart;
    const end = basis === "hobbs" ? leg.hobbsEnd : leg.tachEnd;
    if (start === null || end === null) return null;
    total += (end - start) * 60;
  }
  return Math.round(total);
}

export type AmountInput = {
  flownMinutes: number;
  pricePerHour: number;
  weekendPricePerHour: number | null;
  minHoursPerDay: number | null;
  /** Local days of the booking and whether it started on a weekend (as for the estimate). */
  days: number;
  weekend: boolean;
  /** Fuel: minus fuel the pilot paid on a wet rate, plus fuel the owner supplied on a dry rate. */
  fuelAdjustment: number;
};

/** Amount due: flown hours (at least the daily minimum) × rate, then the fuel adjustment. */
export function amountDue(p: AmountInput): { hours: number; rate: number; amount: number } {
  const price = estimatePrice({
    pricePerHour: p.pricePerHour,
    weekendPricePerHour: p.weekendPricePerHour,
    minHoursPerDay: p.minHoursPerDay,
    priceBasis: "wet",
    fuelBurnLph: null,
    plannedHours: p.flownMinutes / 60,
    days: p.days,
    weekend: p.weekend,
  });
  const amount = Math.max(0, Math.round((price.amount + p.fuelAdjustment) * 100) / 100);
  return { hours: price.billedHours, rate: price.rate, amount };
}
