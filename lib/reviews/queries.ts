import "server-only";

import { and, desc, eq, isNotNull, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { asAnon, asUser } from "@/lib/db/rls";
import { aircraft, profiles, reviews, type ReviewDirection } from "@/lib/db/schema";

export type ReviewView = {
  id: string;
  bookingId: string;
  direction: ReviewDirection;
  overall: number;
  scores: Record<string, number>;
  comment: string | null;
  submittedAt: Date;
  publishedAt: Date | null;
  hiddenAt: Date | null;
  reply: string | null;
  repliedAt: Date | null;
  authorId: string | null;
  author: { name: string; avatarKey: string | null } | null;
  subjectUserId: string | null;
  aircraft: { id: string; registration: string; manufacturer: string; model: string } | null;
};

type Tx = Parameters<Parameters<typeof asAnon>[0]>[0];

/** Reviews as the caller may see them (RLS): their own, and published ones that aren't hidden. */
function selectReviews(tx: Tx, where: SQL | undefined, limit = 50) {
  const author = alias(profiles, "author");
  return tx
    .select({
      id: reviews.id,
      bookingId: reviews.bookingId,
      direction: reviews.direction,
      overall: reviews.overall,
      scores: reviews.scores,
      comment: reviews.comment,
      submittedAt: reviews.submittedAt,
      publishedAt: reviews.publishedAt,
      hiddenAt: reviews.hiddenAt,
      reply: reviews.reply,
      repliedAt: reviews.repliedAt,
      authorId: reviews.authorId,
      authorName: author.displayName,
      authorAvatar: author.avatarKey,
      subjectUserId: reviews.subjectUserId,
      aircraftId: aircraft.id,
      registration: aircraft.registration,
      manufacturer: aircraft.manufacturer,
      model: aircraft.model,
    })
    .from(reviews)
    .leftJoin(author, eq(author.id, reviews.authorId))
    .leftJoin(aircraft, eq(aircraft.id, reviews.subjectAircraftId))
    .where(where)
    .orderBy(desc(sql`coalesce(${reviews.publishedAt}, ${reviews.submittedAt})`))
    .limit(limit)
    .then((rows) =>
      rows.map((r): ReviewView => ({
        id: r.id,
        bookingId: r.bookingId,
        direction: r.direction,
        overall: r.overall,
        scores: r.scores as Record<string, number>,
        comment: r.comment,
        submittedAt: r.submittedAt,
        publishedAt: r.publishedAt,
        hiddenAt: r.hiddenAt,
        reply: r.reply,
        repliedAt: r.repliedAt,
        authorId: r.authorId,
        author: r.authorName ? { name: r.authorName, avatarKey: r.authorAvatar } : null,
        subjectUserId: r.subjectUserId,
        aircraft: r.aircraftId
          ? {
              id: r.aircraftId,
              registration: r.registration!,
              manufacturer: r.manufacturer!,
              model: r.model!,
            }
          : null,
      })),
    );
}

/**
 * The reviews of a booking for one of its sides: their own (always) and the other side's once
 * published (RAT-3), plus when the review window closes (null until the booking is completed).
 */
export async function getBookingReviews(userId: string, bookingId: string) {
  return asUser(userId, async (tx) => {
    const rows = await selectReviews(tx, eq(reviews.bookingId, bookingId));
    const [w] = (await tx.execute(
      sql`select public.review_window_closes(${bookingId}::uuid) as closes`,
    )) as unknown as { closes: string | Date | null }[];
    return {
      mine: rows.find((r) => r.authorId === userId) ?? null,
      theirs: rows.find((r) => r.authorId !== userId && r.publishedAt) ?? null,
      closesAt: w?.closes ? new Date(w.closes) : null,
    };
  });
}

/** Published reviews of a user (as pilot or as owner) or of an aircraft, newest first. */
export async function listPublishedReviews(
  about: { userId: string; direction: ReviewDirection } | { aircraftId: string },
  limit = 20,
) {
  const where =
    "aircraftId" in about
      ? eq(reviews.subjectAircraftId, about.aircraftId)
      : and(eq(reviews.subjectUserId, about.userId), eq(reviews.direction, about.direction));
  return asAnon((tx) => selectReviews(tx, and(where, isNotNull(reviews.publishedAt)), limit));
}

/** Average score per category of the published reviews (RAT-2). */
export async function categoryAverages(
  about: { userId: string; direction: ReviewDirection } | { aircraftId: string },
): Promise<Record<string, number>> {
  const where =
    "aircraftId" in about
      ? sql`r.subject_aircraft_id = ${about.aircraftId}::uuid`
      : sql`r.subject_user_id = ${about.userId}::uuid
          and r.direction = ${about.direction}::public.review_direction`;
  const rows = (await asAnon((tx) =>
    tx.execute(sql`select s.key, round(avg(s.value::numeric), 1)::float8 as avg
      from public.reviews r, jsonb_each_text(r.scores) s
      where ${where} and r.published_at is not null and r.hidden_at is null
      group by s.key`),
  )) as unknown as { key: string; avg: number }[];
  return Object.fromEntries(rows.map((r) => [r.key, Number(r.avg)]));
}
