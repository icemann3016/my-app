"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { requireUser } from "@/lib/auth/session";
import { reportDefect } from "@/lib/bookings/defects";
import { type FormState, formValues } from "@/lib/forms";
import { localizedFieldErrors } from "@/lib/i18n/server";
import { defectSchema } from "@/lib/validation/defect";

/** Report a defect from a booking, its flight log or the owner's Defects tab (BKG-8). */
export async function reportDefectAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("/bookings");
  const t = await getTranslations("defects");
  const raw = formValues(formData);
  const parsed = defectSchema.safeParse(raw);
  if (!parsed.success) return { errors: await localizedFieldErrors(parsed.error), values: raw };
  const result = await reportDefect(user.id, parsed.data);
  if (!result.ok) {
    const known = ["not_found", "description_required", "bad_photo"];
    return {
      message: t(
        `errors.${known.includes(result.error) ? result.error : "failed"}` as "errors.failed",
      ),
      values: raw,
    };
  }
  if (parsed.data.bookingId) revalidatePath(`/bookings/${parsed.data.bookingId}`, "layout");
  revalidatePath(`/owner/aircraft/${parsed.data.aircraftId}`, "layout");
  return { ok: true, message: t("reported") };
}
