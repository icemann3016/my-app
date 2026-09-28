"use server";

import { getTranslations } from "next-intl/server";

import { requireUser } from "@/lib/auth/session";
import { type FormState, formValues } from "@/lib/forms";
import { localizedFieldErrors } from "@/lib/i18n/server";
import { createReport } from "@/lib/reports";
import { reportSchema } from "@/lib/validation/report";

/** Report a review, user, listing or message to the admins (RAT-5, ADM-3). */
export async function reportAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/");
  const t = await getTranslations("reports");
  const raw = formValues(formData);
  const parsed = reportSchema.safeParse(raw);
  if (!parsed.success) return { errors: await localizedFieldErrors(parsed.error), values: raw };
  const result = await createReport(user.id, parsed.data);
  if (result === "not_found") return { message: t("notFound"), values: raw };
  if (result === "too_many") return { message: t("tooMany"), values: raw };
  return { ok: true, message: t(result === "duplicate" ? "alreadyReported" : "sent") };
}
