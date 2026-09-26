/** Reference lists for pilot credentials (EASA Part-FCL / Part-MED). */

export const LICENCE_TYPES = ["lapl_a", "ppl_a", "cpl_a", "atpl_a", "mpl", "other"] as const;
export type LicenceTypeCode = (typeof LICENCE_TYPES)[number];

/** How licences are written on the licence itself (not translated). */
export const LICENCE_LABELS: Record<LicenceTypeCode, string | null> = {
  lapl_a: "LAPL(A)",
  ppl_a: "PPL(A)",
  cpl_a: "CPL(A)",
  atpl_a: "ATPL(A)",
  mpl: "MPL",
  other: null, // translated: "Other licence"
};

export const RATING_KINDS = ["class", "privilege", "type"] as const;
export type RatingKindCode = (typeof RATING_KINDS)[number];

/**
 * Class ratings and privileges to choose from (names in messages/*.json → pilot.classRatings,
 * pilot.privileges); type ratings are free text (ICAO designator).
 */
export const CLASS_RATINGS = ["SEP_LAND", "SEP_SEA", "MEP_LAND", "MEP_SEA", "TMG"] as const;
export const PRIVILEGES = ["NIGHT", "IR", "BIR", "AEROBATIC", "TOWING", "MOUNTAIN"] as const;

export const MEDICAL_CLASSES = ["class1", "class2", "lapl"] as const;
export type MedicalClassCode = (typeof MEDICAL_CLASSES)[number];

/** EASA member states (EU + Iceland, Liechtenstein, Norway, Switzerland) and the UK. */
export const ISSUING_STATES = [
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
  "IS",
  "LI",
  "NO",
  "CH",
  "GB",
] as const;

/** Country name in the user's language, e.g. countryName("BG", "bg") → "България". */
export function countryName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}
