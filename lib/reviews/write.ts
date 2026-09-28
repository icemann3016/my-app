import "server-only";

import { sql } from "drizzle-orm";

import { asUser } from "@/lib/db/rls";

type Result = { ok: true } | { ok: false; error: string };

/** Run a review function as the user; database errors (P0001) come back as their code. */
async function run(userId: string, query: ReturnType<typeof sql>): Promise<Result> {
  try {
    await asUser(userId, (tx) => tx.execute(query));
    return { ok: true };
  } catch (e) {
    const err = (e as { cause?: { code?: string; message?: string } }).cause;
    if (err?.code === "P0001" && err.message) return { ok: false, error: err.message };
    throw e;
  }
}

/** Review a completed booking (RAT-1). Errors: not_found, window_closed, already_reviewed, bad_scores. */
export function submitReview(
  userId: string,
  bookingId: string,
  scores: Record<string, number>,
  comment: string,
) {
  return run(
    userId,
    sql`select public.submit_review(${bookingId}::uuid, ${JSON.stringify(scores)}::jsonb,
      ${comment})`,
  );
}
