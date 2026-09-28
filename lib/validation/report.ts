import { z } from "zod";

export const REPORT_TARGETS = ["review", "user", "aircraft", "message"] as const;
export const REPORT_REASONS = [
  "abuse",
  "personal_data",
  "spam",
  "misleading",
  "unsafe",
  "other",
] as const;

/** A report of a review, user, listing or message (RAT-5, ADM-3). */
export const reportSchema = z.object({
  targetType: z.enum(REPORT_TARGETS),
  targetId: z.uuid(),
  reason: z.enum(REPORT_REASONS, "reasonRequired"),
  details: z.string().trim().max(1000, "textTooLong").optional().default(""),
});
