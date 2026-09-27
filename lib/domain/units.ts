// Conversions between the SI units we store and the units a user prefers (Account → Preferences).
// "metric" = litres and kilograms, "imperial" = US gallons and pounds.

export type UnitSystem = "metric" | "imperial";

export const LITRES_PER_US_GALLON = 3.785411784;
export const KG_PER_LB = 0.45359237;

export function isUnitSystem(value: unknown): value is UnitSystem {
  return value === "metric" || value === "imperial";
}

const round = (value: number, decimals: number) => {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
};

/** Volume the user entered (L or US gal) → litres, one decimal. */
export function volumeToLitres(value: number, units: UnitSystem): number {
  return round(units === "imperial" ? value * LITRES_PER_US_GALLON : value, 1);
}

/** Litres → the user's volume unit, one decimal. */
export function litresToVolume(litres: number, units: UnitSystem): number {
  return round(units === "imperial" ? litres / LITRES_PER_US_GALLON : litres, 1);
}

/** Mass the user entered (kg or lb) → whole kilograms. */
export function massToKg(value: number, units: UnitSystem): number {
  return Math.round(units === "imperial" ? value * KG_PER_LB : value);
}

/** Kilograms → the user's mass unit, whole numbers. */
export function kgToMass(kg: number, units: UnitSystem): number {
  return Math.round(units === "imperial" ? kg / KG_PER_LB : kg);
}
