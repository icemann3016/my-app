// Uploaded private files (licences, medicals; later aircraft documents). The file itself is in
// private storage; access goes through app/api/documents/[id] which checks permissions.
import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull().unique(),
    filename: text("filename").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("documents_owner_id_idx").on(t.ownerId)],
).enableRLS();

/** Audit log of admin actions (document views, verifications, suspensions…). */
export const adminActions = pgTable(
  "admin_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminId: uuid("admin_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("admin_actions_target_idx").on(t.targetType, t.targetId)],
).enableRLS();

export type Document = typeof documents.$inferSelect;
