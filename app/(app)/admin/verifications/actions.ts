"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { reviewCredential } from "@/lib/admin/verifications";
import { requireAdmin } from "@/lib/auth/session";
import type { FormState } from "@/lib/forms";
import { formValues } from "@/lib/forms";
import { localizedFieldErrors } from "@/lib/i18n/server";

const reviewSchema = z
  .object({
    kind: z.enum(["licence", "rating", "medical"]),
    id: z.uuid(),
    version: z.iso.datetime({ offset: true }),
    decision: z.enum(["verify", "reject"]),
    reason: z.string().trim().max(500, "reasonRequired").optional().default(""),
  })
  .refine((d) => d.decision === "verify" || d.reason.length > 0, {
    path: ["reason"],
    error: "reasonRequired",
  });

export async function review(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const t = await getTranslations("admin.review");
  const raw = formValues(formData);
  const parsed = reviewSchema.safeParse(raw);
  if (!parsed.success) return { errors: await localizedFieldErrors(parsed.error), values: raw };

  const { reason, ...rest } = parsed.data;
  const result = await reviewCredential({
    adminId: admin.userId,
    ...rest,
    reason: rest.decision === "reject" ? reason : null,
  });
  if (!result.ok) return { message: t(`errors.${result.error}`), values: raw };

  revalidatePath("/admin/verifications");
  revalidatePath(`/admin/verifications/${result.pilotId}`);
  return { ok: true, message: rest.decision === "verify" ? t("verified") : t("rejected") };
}
