/**
 * Units. We store SI (litres, kilograms) and show what the user chose in Account → Preferences:
 * metric (litres, kg) or imperial (US gallons, lb). Oil uses the aircraft's dipstick unit.
 */
export type Units = "metric" | "imperial";

export const LITRES_PER_US_GALLON = 3.785411784;
export const KG_PER_LB = 0.45359237;
export const LITRES_PER_US_QUART = 0.946352946;

export function isUnits(value: unknown): value is Units {
  return value === "metric" || value === "imperial";
}

const round = (value: number, decimals: number) => {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
};

/** Litres → the user's volume unit ("l" or "usgal"). */
export function volumeFromLitres(litres: number, units: Units) {
  return units === "imperial"
    ? { value: round(litres / LITRES_PER_US_GALLON, 1), unit: "usgal" as const }
    : { value: round(litres, 1), unit: "l" as const };
}

/** A volume the user typed, in their unit, → litres. */
export function volumeToLitres(value: number, units: Units): number {
  return round(units === "imperial" ? value * LITRES_PER_US_GALLON : value, 1);
}

/** Kilograms → the user's mass unit ("kg" or "lb"). */
export function massFromKg(kg: number, units: Units) {
  return units === "imperial"
    ? { value: Math.round(kg / KG_PER_LB), unit: "lb" as const }
    : { value: Math.round(kg), unit: "kg" as const };
}

/** A mass the user typed, in their unit, → kilograms. */
export function massToKg(value: number, units: Units): number {
  return Math.round(units === "imperial" ? value * KG_PER_LB : value);
}
