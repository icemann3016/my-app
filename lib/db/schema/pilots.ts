// Pilot credentials (M3): licences, ratings, medicals and flight experience.
// Users edit their own; admins verify (status). RLS and triggers: db/migrations/0006_pilot_security.sql
import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { documents } from "./documents";

export const verificationStatus = pgEnum("verification_status", [
  "pending",
  "verified",
  "rejected",
]);
export const licenceType = pgEnum("licence_type", [
  "lapl_a",
  "ppl_a",
  "cpl_a",
  "atpl_a",
  "mpl",
  "other",
]);
export const ratingKind = pgEnum("rating_kind", ["class", "type", "privilege"]);
export const medicalClass = pgEnum("medical_class", ["class1", "class2", "lapl"]);

/** Columns every verifiable credential has. */
const review = {
  status: verificationStatus("status").notNull().default("pending"),
  rejectionReason: text("rejection_reason"),
  reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  /** When the 30-day expiry reminder was sent (so it's sent once). */
  reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

const owner = () =>
  uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" });

const document = () => uuid("document_id").references(() => documents.id, { onDelete: "set null" });

export const pilotLicences = pgTable(
  "pilot_licences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: owner(),
    type: licenceType("type").notNull(),
    /** ISO 3166-1 alpha-2 of the issuing authority, e.g. BG */
    issuingState: text("issuing_state").notNull(),
    number: text("number").notNull(),
    issuedOn: date("issued_on"),
    /** EASA licences usually don't expire; kept for licences that do. */
    expiresOn: date("expires_on"),
    documentId: document(),
    ...review,
  },
  (t) => [
    index("pilot_licences_user_id_idx").on(t.userId),
    check("pilot_licences_number_length", sql`char_length(${t.number}) between 1 and 50`),
    check("pilot_licences_state", sql`${t.issuingState} ~ '^[A-Z]{2}$'`),
    check(
      "pilot_licences_dates",
      sql`${t.expiresOn} is null or ${t.issuedOn} is null or ${t.expiresOn} >= ${t.issuedOn}`,
    ),
  ],
).enableRLS();

export const pilotRatings = pgTable(
  "pilot_ratings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: owner(),
    kind: ratingKind("kind").notNull(),
    /** Class: SEP_LAND, MEP_LAND… · privilege: NIGHT, IR… · type: ICAO type designator (C510) */
    code: text("code").notNull(),
    expiresOn: date("expires_on"),
    documentId: document(),
    ...review,
  },
  (t) => [
    index("pilot_ratings_user_id_idx").on(t.userId),
    check("pilot_ratings_code", sql`${t.code} ~ '^[A-Z0-9_]{2,20}$'`),
  ],
).enableRLS();

export const medicals = pgTable(
  "medicals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: owner(),
    class: medicalClass("class").notNull(),
    issuingState: text("issuing_state").notNull(),
    validUntil: date("valid_until").notNull(),
    documentId: document(),
    ...review,
  },
  (t) => [
    index("medicals_user_id_idx").on(t.userId),
    check("medicals_state", sql`${t.issuingState} ~ '^[A-Z]{2}$'`),
  ],
).enableRLS();

/** Self-declared flight experience (not verified in the MVP). */
export const pilotExperience = pgTable(
  "pilot_experience",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    totalHours: numeric("total_hours", { precision: 7, scale: 1, mode: "number" }).notNull(),
    picHours: numeric("pic_hours", { precision: 7, scale: 1, mode: "number" }).notNull(),
    last90DaysHours: numeric("last_90_days_hours", {
      precision: 6,
      scale: 1,
      mode: "number",
    }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "pilot_experience_hours",
      sql`${t.totalHours} >= 0 and ${t.picHours} >= 0 and ${t.last90DaysHours} >= 0
        and ${t.picHours} <= ${t.totalHours} and ${t.last90DaysHours} <= ${t.totalHours}`,
    ),
  ],
).enableRLS();

export const experienceByType = pgTable(
  "experience_by_type",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** ICAO type designator, e.g. C172 */
    aircraftType: text("aircraft_type").notNull(),
    hours: numeric("hours", { precision: 7, scale: 1, mode: "number" }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.aircraftType] }),
    check("experience_by_type_type", sql`${t.aircraftType} ~ '^[A-Z0-9]{2,6}$'`),
    check("experience_by_type_hours", sql`${t.hours} >= 0`),
  ],
).enableRLS();

export type PilotLicence = typeof pilotLicences.$inferSelect;
export type PilotRating = typeof pilotRatings.$inferSelect;
export type Medical = typeof medicals.$inferSelect;
export type VerificationStatus = (typeof verificationStatus.enumValues)[number];
