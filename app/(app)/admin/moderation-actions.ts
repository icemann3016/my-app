"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import {
  allowListing,
  closeReport,
  type ModerationResult,
  setReviewHidden,
  suspendUser,
  unlistAircraft,
  unsuspendUser,
} from "@/lib/admin/moderation";
import { MODERATION_OPS, type ModerationOp } from "@/lib/admin/ops";
import { requireAdmin } from "@/lib/auth/session";
import type { FormState } from "@/lib/forms";

const schema = z.object({
  op: z.enum(MODERATION_OPS),
  targetId: z.uuid(),
  reason: z.string().trim().max(500).optional().default(""),
  /** When acting from a report: close it as resolved too. */
  reportId: z
    .union([z.uuid(), z.literal("")])
    .optional()
    .default(""),
});

/** One moderation action (ADM-2, ADM-3), logged in the audit log. Admins only. */
export async function moderate(_prev: FormState, formData: FormData): Promise<FormState> {
  const { userId: adminId } = await requireAdmin("/admin");
  const t = await getTranslations("admin.moderation");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { message: t("failed") };
  const { op, targetId, reportId } = parsed.data;
  const reason = parsed.data.reason || null;
  const run: Record<ModerationOp, () => Promise<ModerationResult>> = {
    suspend: () => suspendUser(adminId, targetId, reason),
    unsuspend: () => unsuspendUser(adminId, targetId, reason),
    unlist: () => unlistAircraft(adminId, targetId, reason),
    allow_listing: () => allowListing(adminId, targetId, reason),
    hide_review: () => setReviewHidden(adminId, targetId, true, reason),
    show_review: () => setReviewHidden(adminId, targetId, false, reason),
    resolve_report: () => closeReport(adminId, targetId, "resolved", reason),
    dismiss_report: () => closeReport(adminId, targetId, "dismissed", reason),
  };
  const result = await run[op]();
  if (!result.ok) return { message: t(result.error === "self" ? "self" : "notFound") };
  if (reportId && !op.endsWith("_report")) {
    await closeReport(adminId, reportId, "resolved", reason);
  }
  revalidatePath("/", "layout");
  return { ok: true, message: t(`done.${op}`) };
}
