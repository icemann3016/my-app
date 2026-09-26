// European airfields imported from OurAirports (scripts/import-airports.mjs). Public, read-only
// for users. Identified by the OurAirports "ident": the ICAO code when there is one (LBSF),
// otherwise a local id (BG-0004).
import { doublePrecision, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const airports = pgTable(
  "airports",
  {
    ident: text("ident").primaryKey(),
    /** large_airport | medium_airport | small_airport */
    type: text("type").notNull(),
    name: text("name").notNull(),
    icaoCode: text("icao_code"),
    iataCode: text("iata_code"),
    gpsCode: text("gps_code"),
    localCode: text("local_code"),
    municipality: text("municipality"),
    /** ISO 3166-1 alpha-2, e.g. BG */
    country: text("country").notNull(),
    region: text("region"),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    elevationFt: integer("elevation_ft"),
    /** IANA time zone, e.g. Europe/Sofia */
    timezone: text("timezone").notNull(),
    keywords: text("keywords"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("airports_icao_code_idx").on(t.icaoCode),
    index("airports_iata_code_idx").on(t.iataCode),
    index("airports_country_idx").on(t.country),
  ],
).enableRLS();

export type Airport = typeof airports.$inferSelect;
