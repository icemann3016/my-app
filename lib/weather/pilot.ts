import "server-only";

import { and, eq, gte, isNull, or } from "drizzle-orm";

import { asUser } from "@/lib/db/rls";
import { pilotRatings } from "@/lib/db/schema";

/** Whether the user holds a verified, unexpired instrument rating (IR). Own data only. */
export async function hasValidIr(userId: string): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  const rows = await asUser(userId, (tx) =>
    tx
      .select({ id: pilotRatings.id })
      .from(pilotRatings)
      .where(
        and(
          eq(pilotRatings.userId, userId),
          eq(pilotRatings.code, "IR"),
          eq(pilotRatings.status, "verified"),
          or(isNull(pilotRatings.expiresOn), gte(pilotRatings.expiresOn, today)),
        ),
      )
      .limit(1),
  );
  return rows.length > 0;
}
