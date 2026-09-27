// Choices for aircraft listings. Labels live in messages/*.json → "aircraft".
import type { AircraftDocumentKind, AircraftStatus } from "@/lib/db/schema";

export const CATEGORIES = ["aeroplane", "tmg", "ultralight", "helicopter"] as const;
export const FUEL_TYPES = ["avgas_100ll", "ul91", "mogas", "jet_a1"] as const;
export const TRANSPONDERS = ["none", "mode_c", "mode_s", "adsb_out"] as const;
export const PRICE_BASES = ["wet", "dry"] as const;
export const TIME_BASES = ["hobbs", "tach", "block"] as const;
export const OIL_UNITS = ["qt", "l"] as const;
export const CANCELLATION_POLICIES = ["flexible", "moderate", "strict"] as const;
/** Currencies used for aircraft rental in Europe. */
export const CURRENCIES = [
  "EUR",
  "CHF",
  "CZK",
  "DKK",
  "GBP",
  "HUF",
  "NOK",
  "PLN",
  "RON",
  "SEK",
] as const;

/** Documents an admin verifies; an aircraft needs a valid ARC and insurance to be listed. */
export const VERIFIED_DOCUMENT_KINDS = ["cofa", "arc", "insurance"] as const;
/** Reference documents for renters (LST-8). */
export const REFERENCE_DOCUMENT_KINDS = ["poh", "checklist", "weight_balance"] as const;
/** Documents whose expiry date is required. */
export const EXPIRING_DOCUMENT_KINDS: readonly AircraftDocumentKind[] = ["arc", "insurance"];

export const isVerifiedKind = (kind: AircraftDocumentKind) =>
  (VERIFIED_DOCUMENT_KINDS as readonly string[]).includes(kind);

/** What still stops an aircraft being listed (see public.aircraft_listing_gaps). */
export const LISTING_GAPS = ["home_base", "price", "photo", "arc", "insurance"] as const;
export type ListingGap = (typeof LISTING_GAPS)[number];

export const MAX_PHOTOS = 20;

/** Statuses an owner can move to from each status (LST-7). */
export const STATUS_ACTIONS: Record<AircraftStatus, AircraftStatus[]> = {
  draft: ["listed"],
  listed: ["paused", "unlisted"],
  paused: ["listed", "unlisted"],
  unlisted: ["listed"],
  grounded: ["listed", "unlisted"],
};

/** Setup steps of a listing, in order. */
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

export function nextSection(section: Section): Section | null {
  return SECTIONS[SECTIONS.indexOf(section) + 1] ?? null;
}
