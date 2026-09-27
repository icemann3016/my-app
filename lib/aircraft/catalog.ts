/** Reference lists for aircraft listings (labels in messages/*.json → aircraft). */

export const AIRCRAFT_CATEGORIES = ["aeroplane", "tmg", "ultralight", "helicopter"] as const;
export const FUEL_TYPES = ["avgas_100ll", "ul91", "mogas", "jet_a1"] as const;
export const TRANSPONDERS = ["none", "mode_c", "mode_s", "mode_s_es"] as const;
export const OIL_UNITS = ["us_qt", "l"] as const;
export const PRICE_BASES = ["wet", "dry"] as const;
export const TIME_BASES = ["hobbs", "tach", "block"] as const;
export const DOCUMENT_KINDS = ["cofa", "arc", "insurance"] as const;
export const FILE_KINDS = ["poh", "checklist", "weight_balance", "other"] as const;
export const UNRATED_POLICIES = ["checkout", "allow", "deny"] as const;
export const OWNER_STATUSES = ["listed", "paused", "unlisted"] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

/** Fuel names are the same in every language. */
export const FUEL_LABELS: Record<(typeof FUEL_TYPES)[number], string> = {
  avgas_100ll: "AVGAS 100LL",
  ul91: "UL91",
  mogas: "MOGAS",
  jet_a1: "Jet A-1",
};

/** The euro first, then the other currencies used in EASA countries. */
export const CURRENCIES = [
  "EUR",
  "CHF",
  "CZK",
  "DKK",
  "GBP",
  "HUF",
  "ISK",
  "NOK",
  "PLN",
  "RON",
  "SEK",
] as const;

/** Sections of the listing editor, in order ("Save and continue" goes to the next one). */
export const SECTIONS = [
  "details",
  "equipment",
  "base",
  "pricing",
  "photos",
  "documents",
  "requirements",
] as const;
export type Section = (typeof SECTIONS)[number];

export function isSection(value: string): value is Section {
  return (SECTIONS as readonly string[]).includes(value);
}

export function nextSection(section: Section): Section | null {
  const i = SECTIONS.indexOf(section);
  return SECTIONS[i + 1] ?? null;
}

/** Which section fixes each listing problem (codes from public.aircraft_listing_problems). */
export const PROBLEM_SECTION: Record<string, Section> = {
  manufacturer: "details",
  model: "details",
  icao_type: "details",
  seats: "details",
  fuel_type: "details",
  home_airport: "base",
  price: "pricing",
  photo: "photos",
  cofa: "documents",
  arc: "documents",
  insurance: "documents",
};

/** Problems the owner can't fix alone: an admin has to verify the documents. */
export const DOCUMENT_PROBLEMS = ["cofa", "arc", "insurance"] as const;

/** "D-EABC", "lz abc" → "LZ-ABC" style: upper case, no spaces. */
export function normaliseRegistration(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

/** "Cessna 172S Skyhawk" (falls back to the registration for early drafts). */
export function aircraftTitle(a: {
  manufacturer: string | null;
  model: string | null;
  registration: string;
}): string {
  return [a.manufacturer, a.model].filter(Boolean).join(" ") || a.registration;
}
