// Messages between a pilot and an aircraft's owner (M8, MSG-1), in a conversation about a
// booking or, before any booking, about a listing. Only the two participants read them (RLS);
// written through start_conversation() / send_message(). Read markers per side; one email per
// unread streak (lib/messages). RLS and functions: db/migrations/0043_message_security.sql.
import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { aircraft } from "./aircraft";
import { users } from "./auth";
import { bookings } from "./bookings";

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    aircraftId: uuid("aircraft_id")
      .notNull()
      .references(() => aircraft.id, { onDelete: "cascade" }),
    /** Null for an enquiry about the listing. */
    bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "cascade" }),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** The pilot (or the person asking about the listing). */
    pilotId: uuid("pilot_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
    ownerReadAt: timestamp("owner_read_at", { withTimezone: true }),
    pilotReadAt: timestamp("pilot_read_at", { withTimezone: true }),
    // Last "new message" email, so each side gets one per unread streak.
    ownerEmailedAt: timestamp("owner_emailed_at", { withTimezone: true }),
    pilotEmailedAt: timestamp("pilot_emailed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("conversations_booking_idx")
      .on(t.bookingId)
      .where(sql`booking_id is not null`),
    uniqueIndex("conversations_enquiry_idx")
      .on(t.aircraftId, t.pilotId)
      .where(sql`booking_id is null`),
    index("conversations_owner_idx").on(t.ownerId, t.lastMessageAt),
    index("conversations_pilot_idx").on(t.pilotId, t.lastMessageAt),
  ],
).enableRLS();

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("messages_conversation_idx").on(t.conversationId, t.createdAt),
    check("messages_body", sql`char_length(btrim(${t.body})) between 1 and 4000`),
  ],
).enableRLS();

export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
