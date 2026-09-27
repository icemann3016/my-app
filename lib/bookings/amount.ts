import { amountDue, flownMinutes, type LegForTime } from "@/lib/domain/flight-log";
import { isWeekend, localDaysTouched } from "@/lib/domain/time";

type BookingTerms = {
  timeBasis: "hobbs" | "tach" | "block";
  pricePerHour: number;
  weekendPricePerHour: number | null;
  minHoursPerDay: number | null;
};

/**
 * Flown time and amount due of a booking's legs, with the terms agreed at request time (plan
 * §4.8). Pilot and owner see the same numbers; the owner's confirmation stores them.
 */
export function bookingAmount(
  b: BookingTerms,
  period: { from: Date; to: Date },
  timeZone: string,
  legs: LegForTime[],
  fuelAdjustment = 0,
) {
  const minutes = legs.length ? flownMinutes(legs, b.timeBasis) : 0;
  if (minutes === null) return null;
  return {
    minutes,
    fuelAdjustment,
    ...amountDue({
      flownMinutes: minutes,
      pricePerHour: b.pricePerHour,
      weekendPricePerHour: b.weekendPricePerHour,
      minHoursPerDay: b.minHoursPerDay,
      days: localDaysTouched(period.from, period.to, timeZone),
      weekend: isWeekend(period.from, timeZone),
      fuelAdjustment,
    }),
  };
}
