// Aircraft availability (M5): everything that makes an aircraft busy lives in one table, so a
// Postgres exclusion constraint can make double bookings impossible (plan §4.1). The
// constraint, RLS and helper functions are in db/migrations/0010_calendar_security.sql.
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { aircraft } from "./aircraft";
import { users } from "./auth";

/** A Postgres tstzrange, e.g. '["2026-10-01 08:00:00+00","2026-10-01 12:00:00+00")'. */
export const tstzrange = customType<{ data: string; driverData: string }>({
  dataType() {
    return "tstzrange";
  },
});

export const calendarEntryKind = pgEnum("calendar_entry_kind", [
  "booking",
  "owner_use",
  "maintenance",
  "unavailable",
]);

export const calendarEntries = pgTable(
  "calendar_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    aircraftId: uuid("aircraft_id")
      .notNull()
      .references(() => aircraft.id, { onDelete: "cascade" }),
    /** Start inclusive, end exclusive, in UTC. */
    period: tstzrange("period").notNull(),
    kind: calendarEntryKind("kind").notNull(),
    /** The booking that holds this time (M6). */
    bookingId: uuid("booking_id"),
    note: text("note"),
    /** Only active entries block time; declined, expired or cancelled holds are deactivated. */
    active: boolean("active").notNull().default(true),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("calendar_entries_aircraft_idx").on(t.aircraftId),
    check(
      "calendar_entries_period",
      sql`not isempty(${t.period}) and lower_inc(${t.period}) and not upper_inc(${t.period})
        and not lower_inf(${t.period}) and not upper_inf(${t.period})
        and upper(${t.period}) - lower(${t.period}) <= interval '366 days'`,
    ),
    check("calendar_entries_note", sql`char_length(${t.note}) <= 200`),
    check("calendar_entries_booking", sql`(${t.kind} = 'booking') = (${t.bookingId} is not null)`),
  ],
).enableRLS();

export type CalendarEntry = typeof calendarEntries.$inferSelect;
export type CalendarEntryKind = (typeof calendarEntryKind.enumValues)[number];
