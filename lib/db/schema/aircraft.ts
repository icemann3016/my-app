// Aircraft listings (M4): aircraft, photos, verified documents (CofA, ARC, insurance), reference
// files for renters (POH, checklists, W&B) and rental requirements.
// RLS, triggers and the listing rules: db/migrations/0008_aircraft_security.sql
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { airports } from "./airports";
import { users } from "./auth";
import { documents } from "./documents";
import { licenceType, verificationStatus } from "./pilots";

export const aircraftCategory = pgEnum("aircraft_category", [
  "aeroplane",
  "tmg",
  "ultralight",
  "helicopter",
]);
export const fuelType = pgEnum("fuel_type", ["avgas_100ll", "ul91", "mogas", "jet_a1"]);
export const aircraftStatus = pgEnum("aircraft_status", [
  "draft",
  "listed",
  "paused",
  "unlisted",
  "grounded",
]);
export const priceBasis = pgEnum("price_basis", ["wet", "dry"]);
export const timeBasis = pgEnum("time_basis", ["hobbs", "tach", "block"]);
export const transponderType = pgEnum("transponder_type", [
  "none",
  "mode_c",
  "mode_s",
  "mode_s_es",
]);
export const oilUnit = pgEnum("oil_unit", ["us_qt", "l"]);
export const aircraftDocumentKind = pgEnum("aircraft_document_kind", ["cofa", "arc", "insurance"]);
export const aircraftFileKind = pgEnum("aircraft_file_kind", [
  "poh",
  "checklist",
  "weight_balance",
  "other",
]);
export const unratedPolicy = pgEnum("unrated_policy", ["allow", "checkout", "deny"]);

/**
 * One aircraft. Most columns may be empty while it's a draft; the database checks everything a
 * listing needs when the owner publishes it (public.aircraft_listing_problems).
 * Stored in SI units: litres, kilograms; speeds in knots.
 */
export const aircraft = pgTable(
  "aircraft",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Normalised, e.g. LZ-ABC, D-EFGH, N12345 */
    registration: text("registration").notNull(),
    manufacturer: text("manufacturer"),
    model: text("model"),
    /** ICAO type designator, e.g. C172, P28A. Used for "hours on type". */
    icaoType: text("icao_type"),
    year: integer("year"),
    category: aircraftCategory("category").notNull().default("aeroplane"),
    seats: integer("seats"),
    engine: text("engine"),
    fuelType: fuelType("fuel_type"),
    fuelBurnLph: numeric("fuel_burn_lph", { precision: 5, scale: 1, mode: "number" }),
    cruiseKt: integer("cruise_kt"),
    usefulLoadKg: integer("useful_load_kg"),
    enduranceH: numeric("endurance_h", { precision: 3, scale: 1, mode: "number" }),
    oilUnit: oilUnit("oil_unit").notNull().default("us_qt"),

    avionics: text("avionics"),
    autopilot: boolean("autopilot").notNull().default(false),
    transponder: transponderType("transponder").notNull().default("mode_s"),
    adsbOut: boolean("adsb_out").notNull().default(false),
    nightVfr: boolean("night_vfr").notNull().default(false),
    ifr: boolean("ifr").notNull().default(false),
    equipmentNotes: text("equipment_notes"),
    description: text("description"),

    homeAirportIdent: text("home_airport_ident").references(() => airports.ident, {
      onDelete: "set null",
    }),

    pricePerHour: numeric("price_per_hour", { precision: 8, scale: 2, mode: "number" }),
    weekendPricePerHour: numeric("weekend_price_per_hour", {
      precision: 8,
      scale: 2,
      mode: "number",
    }),
    currency: text("currency").notNull().default("EUR"),
    priceBasis: priceBasis("price_basis").notNull().default("wet"),
    timeBasis: timeBasis("time_basis").notNull().default("hobbs"),
    minHoursPerDay: numeric("min_hours_per_day", { precision: 3, scale: 1, mode: "number" }),
    /** Free cancellation until this many hours before the booking starts. */
    freeCancellationHours: integer("free_cancellation_hours").notNull().default(24),
    cancellationNote: text("cancellation_note"),

    status: aircraftStatus("status").notNull().default("draft"),
    /** Why the system changed the status, e.g. "documents_expired". Null when the owner did. */
    statusReason: text("status_reason"),
    /** The owner asked to publish; it goes live as soon as the documents are verified. */
    publishRequestedAt: timestamp("publish_requested_at", { withTimezone: true }),
    listedAt: timestamp("listed_at", { withTimezone: true }),
    ratingAvg: numeric("rating_avg", { precision: 3, scale: 2, mode: "number" }),
    ratingCount: integer("rating_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("aircraft_owner_id_idx").on(t.ownerId),
    index("aircraft_status_idx").on(t.status),
    index("aircraft_home_airport_idx").on(t.homeAirportIdent),
    // One live listing per registration (drafts and unlisted copies don't block anyone).
    uniqueIndex("aircraft_live_registration_idx")
      .on(t.registration)
      .where(sql`status in ('listed', 'paused', 'grounded')`),
    check("aircraft_registration", sql`${t.registration} ~ '^[A-Z0-9][A-Z0-9-]{1,8}[A-Z0-9]$'`),
    check("aircraft_icao_type", sql`${t.icaoType} ~ '^[A-Z0-9]{2,4}$'`),
    check("aircraft_year", sql`${t.year} between 1903 and 2100`),
    check("aircraft_seats", sql`${t.seats} between 1 and 20`),
    check("aircraft_currency", sql`${t.currency} ~ '^[A-Z]{3}$'`),
    check(
      "aircraft_numbers",
      sql`coalesce(${t.fuelBurnLph}, 0) >= 0 and coalesce(${t.cruiseKt}, 0) >= 0
        and coalesce(${t.usefulLoadKg}, 0) >= 0 and coalesce(${t.enduranceH}, 0) >= 0
        and coalesce(${t.pricePerHour}, 0) >= 0 and coalesce(${t.weekendPricePerHour}, 0) >= 0
        and coalesce(${t.minHoursPerDay}, 0) >= 0`,
    ),
    check("aircraft_cancellation_hours", sql`${t.freeCancellationHours} between 0 and 720`),
    check(
      "aircraft_text_lengths",
      sql`char_length(${t.manufacturer}) <= 60 and char_length(${t.model}) <= 60
        and char_length(${t.engine}) <= 100 and char_length(${t.avionics}) <= 200
        and char_length(${t.equipmentNotes}) <= 1000 and char_length(${t.description}) <= 4000
        and char_length(${t.cancellationNote}) <= 500`,
    ),
  ],
).enableRLS();

/** Public photos (public storage, key aircraft/<aircraft-id>/<uuid>.<ext>). Lowest sort_order = cover. */
export const aircraftPhotos = pgTable(
  "aircraft_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    aircraftId: uuid("aircraft_id")
      .notNull()
      .references(() => aircraft.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull().unique(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("aircraft_photos_aircraft_idx").on(t.aircraftId, t.sortOrder)],
).enableRLS();

/** Documents an admin verifies before the aircraft can be listed. */
export const aircraftDocuments = pgTable(
  "aircraft_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    aircraftId: uuid("aircraft_id")
      .notNull()
      .references(() => aircraft.id, { onDelete: "cascade" }),
    kind: aircraftDocumentKind("kind").notNull(),
    expiresOn: date("expires_on"),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
    status: verificationStatus("status").notNull().default("pending"),
    rejectionReason: text("rejection_reason"),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("aircraft_documents_aircraft_idx").on(t.aircraftId),
    check("aircraft_documents_expiry", sql`${t.kind} = 'cofa' or ${t.expiresOn} is not null`),
  ],
).enableRLS();

/** Reference files for renters: POH/AFM extract, checklists, weight & balance. Not verified. */
export const aircraftFiles = pgTable(
  "aircraft_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    aircraftId: uuid("aircraft_id")
      .notNull()
      .references(() => aircraft.id, { onDelete: "cascade" }),
    kind: aircraftFileKind("kind").notNull(),
    title: text("title"),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("aircraft_files_aircraft_idx").on(t.aircraftId),
    check("aircraft_files_title", sql`char_length(${t.title}) <= 100`),
  ],
).enableRLS();

/** Who may rent the aircraft (RAT-6, RAT-7). Empty values mean "no requirement". */
export const rentalRequirements = pgTable(
  "rental_requirements",
  {
    aircraftId: uuid("aircraft_id")
      .primaryKey()
      .references(() => aircraft.id, { onDelete: "cascade" }),
    minPilotRating: numeric("min_pilot_rating", { precision: 2, scale: 1, mode: "number" }),
    /** Pilots with fewer reviews than this count as "not rated yet". */
    minReviews: integer("min_reviews").notNull().default(1),
    unratedPolicy: unratedPolicy("unrated_policy").notNull().default("checkout"),
    /** Empty = any licence. */
    licenceTypes: licenceType("licence_types")
      .array()
      .notNull()
      .default(sql`'{}'`),
    /** Rating codes the pilot must hold, e.g. SEP_LAND, NIGHT, C510. */
    requiredRatings: text("required_ratings")
      .array()
      .notNull()
      .default(sql`'{}'`),
    minTotalHours: numeric("min_total_hours", { precision: 6, scale: 1, mode: "number" }),
    minTypeHours: numeric("min_type_hours", { precision: 6, scale: 1, mode: "number" }),
    min90DayHours: numeric("min_90_day_hours", { precision: 5, scale: 1, mode: "number" }),
    minAge: integer("min_age"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "rental_requirements_values",
      sql`(${t.minPilotRating} is null or ${t.minPilotRating} between 1 and 5)
        and ${t.minReviews} between 1 and 50
        and coalesce(${t.minTotalHours}, 0) >= 0 and coalesce(${t.minTypeHours}, 0) >= 0
        and coalesce(${t.min90DayHours}, 0) >= 0
        and (${t.minAge} is null or ${t.minAge} between 16 and 99)
        and cardinality(${t.requiredRatings}) <= 10`,
    ),
  ],
).enableRLS();

export type Aircraft = typeof aircraft.$inferSelect;
export type AircraftPhoto = typeof aircraftPhotos.$inferSelect;
export type AircraftDocument = typeof aircraftDocuments.$inferSelect;
export type AircraftFile = typeof aircraftFiles.$inferSelect;
export type RentalRequirements = typeof rentalRequirements.$inferSelect;
export type AircraftStatus = (typeof aircraftStatus.enumValues)[number];
