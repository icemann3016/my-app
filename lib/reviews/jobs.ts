import "server-only";

import { sql } from "drizzle-orm";

import { getDb } from "@/lib/db";

/** Daily job: publish reviews whose 14-day window has closed (RAT-3). Returns how many. */
export async function publishDueReviews(): Promise<number> {
  const [row] = (await getDb().execute(
    sql`select public.publish_due_reviews() as n`,
  )) as unknown as { n: number }[];
  return row?.n ?? 0;
}
