// Public profiles, private settings and roles (M1). Access rules (RLS policies, grants,
// triggers) live in the SQL migration db/migrations/0001_security.sql.
import { sql } from "drizzle-orm";
import {
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("user_settings_locale", sql`${t.locale} in ('en', 'bg')`),
    check("user_settings_units", sql`${t.units} in ('metric', 'imperial')`),
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
