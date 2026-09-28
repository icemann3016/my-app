// Bookings (M6). Created and changed only through SQL functions (request_booking, respond_to_booking,
// cancel_booking…) that check eligibility and hold the calendar; users only read them (RLS).
// Functions, policies and triggers: db/migrations/0015_booking_functions.sql.
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { aircraft, cancellationPolicy, priceBasis, timeBasis } from "./aircraft";
import { airports } from "./airports";
import { users } from "./auth";
import { tstzrange } from "./calendar";

export const bookingStatus = pgEnum("booking_status", [
  "requested",
  "accepted",
  "declined",
  "expired",
  "cancelled",
  "in_progress",
  "completed",
]);
export const bookingPurpose = pgEnum("booking_purpose", [
  "local",
  "cross_country",
  "training",
  "other",
]);

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Deleting an aircraft or its owner removes its bookings (the app refuses while any are
    // upcoming); a deleted pilot's past bookings stay for the owner, without the pilot.
    aircraftId: uuid("aircraft_id")
      .notNull()
      .references(() => aircraft.id, { onDelete: "cascade" }),
    pilotId: uuid("pilot_id").references(() => users.id, { onDelete: "set null" }),
    /** The aircraft's owner when requested (kept for access rules and history). */
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: bookingStatus("status").notNull().default("requested"),
    /** Start inclusive, end exclusive, UTC. */
    period: tstzrange("period").notNull(),
    /** The flight's airfields: legally what counts for night and weather (not any home base). */
    departureIdent: text("departure_ident")
      .notNull()
      .references(() => airports.ident),
    arrivalIdent: text("arrival_ident")
      .notNull()
      .references(() => airports.ident),
    stops: text("stops")
      .array()
      .notNull()
      .default(sql`'{}'`),
    purpose: bookingPurpose("purpose").notNull(),
    passengers: smallint("passengers").notNull().default(0),
    plannedHours: numeric("planned_hours", { precision: 4, scale: 1, mode: "number" }).notNull(),
    message: text("message"),
    // Price when requested (BKG-2); payment is arranged with the owner directly in the MVP.
    pricePerHour: numeric("price_per_hour", { precision: 8, scale: 2, mode: "number" }).notNull(),
    currency: text("currency").notNull(),
    weekendPricePerHour: numeric("weekend_price_per_hour", {
      precision: 8,
      scale: 2,
      mode: "number",
    }),
    minHoursPerDay: numeric("min_hours_per_day", { precision: 3, scale: 1, mode: "number" }),
    priceBasis: priceBasis("price_basis").notNull(),
    timeBasis: timeBasis("time_basis").notNull(),
    estimate: numeric("estimate", { precision: 10, scale: 2, mode: "number" }).notNull(),
    /** The owner's cancellation policy when requested (BKG-6). */
    cancellationPolicy: cancellationPolicy("cancellation_policy").notNull().default("moderate"),
    /** The owner asked for a checkout flight with an instructor first (RAT-7, BKG-10). */
    checkoutRequired: boolean("checkout_required").notNull().default(false),
    /** A request the owner doesn't answer by then expires and frees the calendar (BKG-3). */
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    ownerNote: text("owner_note"),
    /** When declining, the owner can suggest another time; the pilot can request it (BKG-3). */
    proposedPeriod: tstzrange("proposed_period"),
    cancelledBy: uuid("cancelled_by").references(() => users.id, { onDelete: "set null" }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
    /** Cancelled after the policy's free-cancellation deadline (BKG-6). */
    lateCancellation: boolean("late_cancellation").notNull().default(false),
    // The 24-hour reminder (BKG-9) went out; set by the daily job.
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("bookings_aircraft_idx").on(t.aircraftId),
    index("bookings_pilot_idx").on(t.pilotId),
    index("bookings_owner_idx").on(t.ownerId),
    index("bookings_status_idx").on(t.status, t.expiresAt),
    check("bookings_passengers", sql`${t.passengers} between 0 and 19`),
    check("bookings_hours", sql`${t.plannedHours} > 0`),
    check("bookings_stops", sql`cardinality(${t.stops}) <= 5`),
    check(
      "bookings_texts",
      sql`char_length(${t.message}) <= 1000 and char_length(${t.ownerNote}) <= 500
        and char_length(${t.cancelReason}) <= 500`,
    ),
  ],
).enableRLS();

/** History of a booking: who did what, when (plan §5). */
export const bookingEvents = pgTable(
  "booking_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    type: text("type").notNull(),
    payload: jsonb("payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("booking_events_booking_idx").on(t.bookingId, t.createdAt)],
).enableRLS();

export type Booking = typeof bookings.$inferSelect;
export type BookingStatus = (typeof bookingStatus.enumValues)[number];
export type BookingPurpose = (typeof bookingPurpose.enumValues)[number];
