"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { requireUser } from "@/lib/auth/session";
import { type FormState, formValues } from "@/lib/forms";
import { localizedFieldErrors } from "@/lib/i18n/server";
import { sendNotificationsSoon } from "@/lib/notifications/soon";
import { submitReview } from "@/lib/reviews/write";
import { reviewSchema, reviewScores } from "@/lib/validation/review";

/** Review a completed booking (RAT-1, RAT-2). */
export async function submitReviewAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formValues(formData);
  const user = await requireUser(`/bookings/${raw.bookingId ?? ""}`);
  const t = await getTranslations("reviews");
  const direction = raw.direction === "owner_to_pilot" ? "owner_to_pilot" : "pilot_to_owner";
  const parsed = reviewSchema(direction).safeParse(raw);
  if (!parsed.success) return { errors: await localizedFieldErrors(parsed.error), values: raw };
  const { bookingId, comment } = parsed.data;
  const result = await submitReview(
    user.id,
    bookingId,
    reviewScores(direction, parsed.data),
    comment,
  );
  if (!result.ok) {
    const known = ["not_found", "window_closed", "already_reviewed", "bad_scores"];
    const key = known.includes(result.error) ? result.error : "failed";
    return { message: t(`errors.${key}` as "errors.failed"), values: raw };
  }
  sendNotificationsSoon();
  revalidatePath(`/bookings/${bookingId}`);
  return { ok: true, message: t("submitted") };
}
