// Reports of reviews, users, listings and messages (RAT-5, ADM-3). Anyone logged in can report
// what they can see; admins work through the queue and resolve or dismiss. Hiding a review or
// suspending a user is a separate admin action (admin_actions).
// RLS: db/migrations/0041_report_security.sql.
import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";

export const reportTarget = pgEnum("report_target", ["review", "user", "aircraft", "message"]);
export const reportReason = pgEnum("report_reason", [
  "abuse",
  "personal_data",
  "spam",
  "misleading",
  "unsafe",
  "other",
]);
export const reportStatus = pgEnum("report_status", ["open", "resolved", "dismissed"]);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reporterId: uuid("reporter_id").references(() => users.id, { onDelete: "set null" }),
    targetType: reportTarget("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    reason: reportReason("reason").notNull(),
    details: text("details"),
    status: reportStatus("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: uuid("resolved_by").references(() => users.id, { onDelete: "set null" }),
    resolution: text("resolution"),
  },
  (t) => [
    index("reports_queue_idx").on(t.status, t.createdAt),
    index("reports_target_idx").on(t.targetType, t.targetId),
    // One open report per person and target.
    uniqueIndex("reports_one_open")
      .on(t.reporterId, t.targetType, t.targetId)
      .where(sql`status = 'open'`),
    check(
      "reports_texts",
      sql`char_length(${t.details}) <= 1000 and char_length(${t.resolution}) <= 1000`,
    ),
  ],
).enableRLS();

export type Report = typeof reports.$inferSelect;
export type ReportTarget = (typeof reportTarget.enumValues)[number];
export type ReportReason = (typeof reportReason.enumValues)[number];
export type ReportStatus = (typeof reportStatus.enumValues)[number];
