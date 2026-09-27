"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { reviewAircraftDocument } from "@/lib/admin/aircraft-review";
import { reviewCredential } from "@/lib/admin/verifications";
import { requireAdmin } from "@/lib/auth/session";
import type { FormState } from "@/lib/forms";
import { formValues } from "@/lib/forms";
import { localizedFieldErrors } from "@/lib/i18n/server";

const reviewSchema = z
  .object({
    kind: z.enum(["licence", "rating", "medical", "aircraft_document"]),
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

  const { reason, kind, ...rest } = parsed.data;
  const common = {
    adminId: admin.userId,
    ...rest,
    reason: rest.decision === "reject" ? reason : null,
  };

  if (kind === "aircraft_document") {
    const result = await reviewAircraftDocument(common);
    if (!result.ok) return { message: t(`errors.${result.error}`), values: raw };
    revalidatePath("/admin/verifications");
    revalidatePath(`/admin/verifications/aircraft/${result.aircraftId}`);
    revalidatePath(`/owner/aircraft/${result.aircraftId}`, "layout");
    revalidatePath(`/aircraft/${result.aircraftId}`);
    const message =
      rest.decision === "reject"
        ? t("rejectedOwner")
        : result.listed
          ? t("verifiedAndListed")
          : t("verifiedOwner");
    return { ok: true, message };
  }

  const result = await reviewCredential({ ...common, kind });
  if (!result.ok) return { message: t(`errors.${result.error}`), values: raw };
  revalidatePath("/admin/verifications");
  revalidatePath(`/admin/verifications/${result.pilotId}`);
  return { ok: true, message: rest.decision === "verify" ? t("verified") : t("rejected") };
}
