// Two-way reviews after a completed booking (M7, RAT-1…5; plan §4.3). Double-blind: a review is
// visible only to its author until both sides have reviewed or the 14-day window has closed.
// Written only through submit_review(); published by trigger or the daily job, which also keeps
// the rating averages on profiles and aircraft. RLS and functions: db/migrations/0039_review_security.sql.
import { sql } from "drizzle-orm";
import {
  check,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { aircraft } from "./aircraft";
import { users } from "./auth";
import { bookings } from "./bookings";

/** pilot_to_owner rates the aircraft and its owner; owner_to_pilot rates the pilot. */
export const reviewDirection = pgEnum("review_direction", ["pilot_to_owner", "owner_to_pilot"]);

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    direction: reviewDirection("direction").notNull(),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    subjectUserId: uuid("subject_user_id").references(() => users.id, { onDelete: "set null" }),
    /** The aircraft, for pilot_to_owner reviews. */
    subjectAircraftId: uuid("subject_aircraft_id").references(() => aircraft.id, {
      onDelete: "set null",
    }),
    /** Category scores 1–5 (RAT-2), keys depend on the direction. */
    scores: jsonb("scores").notNull(),
    /** Average of the category scores. */
    overall: numeric("overall", { precision: 3, scale: 2, mode: "number" }).notNull(),
    comment: text("comment"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    // Admins hide reviews that break the rules (RAT-5), never just for being negative.
    hiddenAt: timestamp("hidden_at", { withTimezone: true }),
    hiddenBy: uuid("hidden_by").references(() => users.id, { onDelete: "set null" }),
    hiddenReason: text("hidden_reason"),
    /** The owner's one public reply (RAT-5). */
    reply: text("reply"),
    repliedAt: timestamp("replied_at", { withTimezone: true }),
  },
  (t) => [
    unique("reviews_one_per_side").on(t.bookingId, t.direction),
    index("reviews_subject_user_idx").on(t.subjectUserId, t.publishedAt),
    index("reviews_subject_aircraft_idx").on(t.subjectAircraftId, t.publishedAt),
    index("reviews_unpublished_idx")
      .on(t.submittedAt)
      .where(sql`published_at is null`),
    check("reviews_overall", sql`${t.overall} between 1 and 5`),
    check(
      "reviews_texts",
      sql`char_length(${t.comment}) <= 2000 and char_length(${t.reply}) <= 1000
        and char_length(${t.hiddenReason}) <= 500`,
    ),
  ],
).enableRLS();

export type Review = typeof reviews.$inferSelect;
export type ReviewDirection = (typeof reviewDirection.enumValues)[number];
