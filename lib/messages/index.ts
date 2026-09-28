import "server-only";

import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { asUser } from "@/lib/db/rls";
import { aircraft, bookings, conversations, messages, profiles } from "@/lib/db/schema";

export type ConversationSummary = {
  id: string;
  bookingId: string | null;
  isOwner: boolean;
  other: { id: string; name: string; avatarKey: string | null } | null;
  aircraft: { id: string; registration: string; manufacturer: string; model: string };
  lastMessageAt: Date;
  lastMessage: string | null;
  unread: boolean;
};

/** Aircraft labels for conversations the user is in (trusted read: RLS already checked access). */
async function aircraftLabels(ids: string[]) {
  if (!ids.length) return new Map<string, ConversationSummary["aircraft"]>();
  const rows = await getDb()
    .select({
      id: aircraft.id,
      registration: aircraft.registration,
      manufacturer: aircraft.manufacturer,
      model: aircraft.model,
    })
    .from(aircraft)
    .where(inArray(aircraft.id, ids));
  return new Map(rows.map((r) => [r.id, r]));
}

const unreadFor = (userId: string) =>
  sql<boolean>`case when ${conversations.ownerId} = ${userId}::uuid
    then coalesce(${conversations.ownerReadAt} < ${conversations.lastMessageAt}, true)
    else coalesce(${conversations.pilotReadAt} < ${conversations.lastMessageAt}, true) end`;

/** The user's conversations, newest first (MSG-1). */
export async function listConversations(userId: string): Promise<ConversationSummary[]> {
  const rows = await asUser(userId, (tx) =>
    tx
      .select({
        c: conversations,
        unread: unreadFor(userId),
        last: sql<string | null>`(select m.body from public.messages m
          where m.conversation_id = "conversations"."id" order by m.created_at desc limit 1)`,
      })
      .from(conversations)
      .where(or(eq(conversations.ownerId, userId), eq(conversations.pilotId, userId)))
      .orderBy(desc(conversations.lastMessageAt))
      .limit(100),
  );
  const labels = await aircraftLabels([...new Set(rows.map((r) => r.c.aircraftId))]);
  const others = await otherProfiles(rows.map((r) => otherId(r.c, userId)));
  return rows.map(({ c, unread, last }) => ({
    id: c.id,
    bookingId: c.bookingId,
    isOwner: c.ownerId === userId,
    other: others.get(otherId(c, userId) ?? "") ?? null,
    aircraft: labels.get(c.aircraftId)!,
    lastMessageAt: c.lastMessageAt,
    lastMessage: last,
    unread: Boolean(unread) && last !== null,
  }));
}

const otherId = (c: { ownerId: string; pilotId: string | null }, userId: string) =>
  c.ownerId === userId ? c.pilotId : c.ownerId;

async function otherProfiles(ids: (string | null)[]) {
  const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!wanted.length) return new Map<string, NonNullable<ConversationSummary["other"]>>();
  const rows = await getDb()
    .select({ id: profiles.id, name: profiles.displayName, avatarKey: profiles.avatarKey })
    .from(profiles)
    .where(inArray(profiles.id, wanted));
  return new Map(rows.map((r) => [r.id, r]));
}

/** Number of conversations with messages the user hasn't read (header badge). */
export async function unreadConversations(userId: string): Promise<number> {
  const [row] = await asUser(userId, (tx) =>
    tx
      .select({ n: sql<number>`count(*)::int` })
      .from(conversations)
      .where(
        and(
          or(eq(conversations.ownerId, userId), eq(conversations.pilotId, userId)),
          unreadFor(userId),
          sql`exists (select 1 from public.messages m where m.conversation_id = "conversations"."id"
            and m.sender_id is distinct from ${userId}::uuid)`,
        ),
      ),
  );
  return row?.n ?? 0;
}

/** A conversation with its messages, marked as read; null if the user isn't in it. */
export async function openConversation(userId: string, id: string) {
  const found = await asUser(userId, async (tx) => {
    const [c] = await tx.select().from(conversations).where(eq(conversations.id, id));
    if (!c) return null;
    const list = await tx
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(asc(messages.createdAt));
    await tx.execute(sql`select public.mark_conversation_read(${id}::uuid)`);
    return { c, list };
  });
  if (!found) return null;
  const { c, list } = found;
  const [labels, others, booking] = await Promise.all([
    aircraftLabels([c.aircraftId]),
    otherProfiles([otherId(c, userId)]),
    c.bookingId
      ? getDb()
          .select({ status: bookings.status, from: sql<string>`lower(${bookings.period})` })
          .from(bookings)
          .where(eq(bookings.id, c.bookingId))
          .then((r) => r[0] ?? null)
      : null,
  ]);
  return {
    id: c.id,
    bookingId: c.bookingId,
    booking: booking ? { status: booking.status, from: new Date(booking.from) } : null,
    isOwner: c.ownerId === userId,
    canWrite: Boolean(c.pilotId),
    other: others.get(otherId(c, userId) ?? "") ?? null,
    aircraft: labels.get(c.aircraftId)!,
    messages: list,
  };
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch (e) {
    const err = (e as { cause?: { code?: string; message?: string } }).cause;
    if (err?.code === "P0001" && err.message) return { ok: false, error: err.message };
    throw e;
  }
}

/** Open (or find) the conversation about a booking or listing; sends `body` if given. */
export function startConversation(
  userId: string,
  target: { aircraftId: string; bookingId: string | null },
  body: string | null,
) {
  return run(async () => {
    const [row] = (await asUser(userId, (tx) =>
      tx.execute(sql`select public.start_conversation(${target.aircraftId}::uuid,
        ${target.bookingId}::uuid, ${body}) as id`),
    )) as unknown as { id: string }[];
    return row!.id;
  });
}

export function sendMessage(userId: string, conversationId: string, body: string) {
  return run(() =>
    asUser(userId, (tx) =>
      tx.execute(sql`select public.send_message(${conversationId}::uuid, ${body})`),
    ),
  );
}

/** The user's enquiry about a listing, if they already started one. */
export async function findEnquiry(userId: string, aircraftId: string) {
  const [row] = await asUser(userId, (tx) =>
    tx
      .select({ id: conversations.id })
      .from(conversations)
      .where(
        and(
          eq(conversations.aircraftId, aircraftId),
          eq(conversations.pilotId, userId),
          sql`${conversations.bookingId} is null`,
        ),
      ),
  );
  return row?.id ?? null;
}
