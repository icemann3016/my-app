// Defects (BKG-8): something wrong with the aircraft that may affect airworthiness, reported by a
// renter or the owner. The owner is told at once and can ground the aircraft (aircraft.status =
// 'grounded'), which blocks bookings until cleared. Not a technical log: no CRS or deferral here.
// RLS and functions: db/migrations/0030_defect_security.sql.
import { sql } from "drizzle-orm";
import { check, index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { aircraft } from "./aircraft";
import { users } from "./auth";
import { bookings } from "./bookings";
import { documents } from "./documents";

export const defectSeverity = pgEnum("defect_severity", ["minor", "major", "unsafe"]);

export const defects = pgTable(
  "defects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    aircraftId: uuid("aircraft_id")
      .notNull()
      .references(() => aircraft.id, { onDelete: "cascade" }),
    bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "set null" }),
    reportedBy: uuid("reported_by").references(() => users.id, { onDelete: "set null" }),
    severity: defectSeverity("severity").notNull(),
    description: text("description").notNull(),
    photoId: uuid("photo_id").references(() => documents.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: uuid("resolved_by").references(() => users.id, { onDelete: "set null" }),
    resolution: text("resolution"),
  },
  (t) => [
    index("defects_aircraft_idx").on(t.aircraftId, t.createdAt),
    check(
      "defects_text",
      sql`char_length(btrim(${t.description})) between 1 and 2000
        and char_length(${t.resolution}) <= 1000`,
    ),
  ],
).enableRLS();

export type Defect = typeof defects.$inferSelect;
export type DefectSeverity = (typeof defectSeverity.enumValues)[number];
