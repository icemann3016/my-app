// Public profiles, private settings and roles (M1). Access rules (RLS policies, grants,
// triggers) live in the SQL migration db/migrations/0001_security.sql.
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { airports } from "./airports";
import { users } from "./auth";

export const appRole = pgEnum("app_role", ["pilot", "owner", "admin"]);

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    bio: text("bio"),
    avatarKey: text("avatar_key"),
    homeAirportIdent: text("home_airport_ident").references(() => airports.ident, {
      onDelete: "set null",
    }),
    ratingAvg: numeric("rating_avg", { precision: 3, scale: 2, mode: "number" }),
    ratingCount: integer("rating_count").notNull().default(0),
    // As an owner: published reviews of their aircraft (M7). rating_* above is as a pilot.
    ownerRatingAvg: numeric("owner_rating_avg", { precision: 3, scale: 2, mode: "number" }),
    ownerRatingCount: integer("owner_rating_count").notNull().default(0),
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "profiles_display_name_length",
      sql`char_length(btrim(${t.displayName})) between 1 and 80`,
    ),
    check("profiles_bio_length", sql`char_length(${t.bio}) <= 1000`),
  ],
).enableRLS();

export const userSettings = pgTable(
  "user_settings",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    locale: text("locale").notNull().default("en"),
    units: text("units").notNull().default("metric"),
    // Shared only with the other side of an accepted booking (MSG-2), see booking_contacts().
    phone: text("phone"),
    // Notification channels per kind (MSG-3). Safety and account emails are always sent.
    emailBookings: boolean("email_bookings").notNull().default(true),
    inAppBookings: boolean("in_app_bookings").notNull().default(true),
    emailReviews: boolean("email_reviews").notNull().default(true),
    inAppReviews: boolean("in_app_reviews").notNull().default(true),
    emailMessages: boolean("email_messages").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("user_settings_locale", sql`${t.locale} in ('en', 'bg', 'de', 'fr', 'it', 'es')`),
    check("user_settings_units", sql`${t.units} in ('metric', 'imperial')`),
    check("user_settings_phone", sql`${t.phone} ~ '^\\+[0-9 ]{6,20}$'`),
  ],
).enableRLS();

export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: appRole("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.role] })],
).enableRLS();

export type Profile = typeof profiles.$inferSelect;
export type AppRole = (typeof appRole.enumValues)[number];
