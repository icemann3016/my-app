import "server-only";

import { asUser } from "@/lib/db/rls";
import { reports, type ReportReason, type ReportTarget } from "@/lib/db/schema";

/**
 * Report something the user can see (RLS checks it). Returns "duplicate" when they already have
 * an open report of it, "not_found" when they can't see it.
 */
export async function createReport(
  userId: string,
  r: { targetType: ReportTarget; targetId: string; reason: ReportReason; details: string },
): Promise<"ok" | "duplicate" | "not_found" | "too_many"> {
  try {
    await asUser(userId, (tx) =>
      tx.insert(reports).values({ reporterId: userId, ...r, details: r.details || null }),
    );
    return "ok";
  } catch (e) {
    const { code, message } = (e as { cause?: { code?: string; message?: string } }).cause ?? {};
    if (code === "23505") return "duplicate";
    if (code === "P0001" && message === "too_many_reports") return "too_many";
    if (code === "42501") return "not_found";
    throw e;
  }
}
