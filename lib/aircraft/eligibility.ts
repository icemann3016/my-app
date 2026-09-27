import "server-only";

import { sql } from "drizzle-orm";

import { asUser } from "@/lib/db/rls";
import type { EligibilityFailure } from "./eligibility-text";

/**
 * The logged-in pilot's failed requirements for an aircraft (empty = may ask), for a period in
 * UTC or today. Only the pilot's own result: owners get a yes/no in M6.
 */
export async function getMyEligibility(
  userId: string,
  aircraftId: string,
  period?: { from: Date; to: Date },
): Promise<EligibilityFailure[]> {
  const range = period
    ? sql`tstzrange(${period.from.toISOString()}::timestamptz, ${period.to.toISOString()}::timestamptz, '[)')`
    : sql`null::tstzrange`;
  return (await asUser(userId, (tx) =>
    tx.execute(sql`select * from public.my_eligibility(${aircraftId}::uuid, ${range})`),
  )) as unknown as EligibilityFailure[];
}
