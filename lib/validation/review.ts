import { z } from "zod";

import type { ReviewDirection } from "@/lib/db/schema";
import { REVIEW_CATEGORIES } from "@/lib/reviews/categories";

const score = z.coerce
  .number("scoreRequired")
  .int("scoreRequired")
  .min(1, "scoreRequired")
  .max(5, "scoreRequired");

/**
 * A review of a completed booking (RAT-1, RAT-2): one score 1–5 per category of the direction,
 * sent as fields `score_<category>`, plus an optional comment. Messages are "validation" keys.
 */
export function reviewSchema(direction: ReviewDirection) {
  const scores = Object.fromEntries(REVIEW_CATEGORIES[direction].map((c) => [`score_${c}`, score]));
  return z.object({
    bookingId: z.uuid(),
    comment: z.string().trim().max(2000, "textTooLong").optional().default(""),
    ...scores,
  });
}

/** The scores object submit_review() expects, from parsed form data. */
export function reviewScores(direction: ReviewDirection, data: Record<string, unknown>) {
  return Object.fromEntries(
    REVIEW_CATEGORIES[direction].map((c) => [c, Number(data[`score_${c}`])]),
  ) as Record<string, number>;
}

/** A reply to a review, or a report of one (RAT-5). */
export const reviewReplySchema = z.object({
  reviewId: z.uuid(),
  text: z.string().trim().min(1, "replyRequired").max(1000, "textTooLong"),
});
