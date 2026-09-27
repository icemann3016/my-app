// Price estimate of a booking request (BKG-2). Payment is arranged with the owner directly in the
// MVP; this is the number both sides see when the request is sent.

export type PriceInput = {
  pricePerHour: number;
  weekendPricePerHour: number | null;
  minHoursPerDay: number | null;
  priceBasis: "wet" | "dry";
  fuelBurnLph: number | null;
  /** Hours the pilot plans to fly. */
  plannedHours: number;
  /** Local calendar days the rental touches (at least 1). */
  days: number;
  /** The rental starts on a Saturday or Sunday (local time). */
  weekend: boolean;
};

export type PriceEstimate = {
  rate: number;
  /** Hours charged: the planned hours, but at least the owner's daily minimum. */
  billedHours: number;
  amount: number;
  /** Dry rentals: fuel isn't included; roughly this many litres will be used. */
  fuelLitres: number | null;
};

const round = (n: number, decimals: number) => Math.round(n * 10 ** decimals) / 10 ** decimals;

export function estimatePrice(p: PriceInput): PriceEstimate {
  const rate = p.weekend && p.weekendPricePerHour ? p.weekendPricePerHour : p.pricePerHour;
  const minimum = p.minHoursPerDay ? p.minHoursPerDay * Math.max(p.days, 1) : 0;
  const billedHours = round(Math.max(p.plannedHours, minimum), 1);
  return {
    rate,
    billedHours,
    amount: round(billedHours * rate, 2),
    fuelLitres:
      p.priceBasis === "dry" && p.fuelBurnLph ? Math.round(p.plannedHours * p.fuelBurnLph) : null,
  };
}
