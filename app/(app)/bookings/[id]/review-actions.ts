"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { requireUser } from "@/lib/auth/session";
import { type FormState, formValues } from "@/lib/forms";
import { localizedFieldErrors } from "@/lib/i18n/server";
import { sendNotificationsSoon } from "@/lib/notifications/soon";
import { replyToReview, submitReview } from "@/lib/reviews/write";
import { reviewReplySchema, reviewSchema, reviewScores } from "@/lib/validation/review";

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

/** The owner replies publicly, once, to a review of their aircraft (RAT-5). */
export async function replyToReviewAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser("/bookings");
  const t = await getTranslations("reviews");
  const raw = formValues(formData);
  const parsed = reviewReplySchema.safeParse(raw);
  if (!parsed.success) return { errors: await localizedFieldErrors(parsed.error), values: raw };
  const result = await replyToReview(user.id, parsed.data.reviewId, parsed.data.text);
  if (!result.ok) {
    const known = ["not_found", "already_replied", "reply_required"];
    const key = known.includes(result.error) ? result.error : "failed";
    return { message: t(`replyErrors.${key}` as "replyErrors.failed"), values: raw };
  }
  sendNotificationsSoon();
  // The reply shows on the booking, the aircraft page and the owner's profile.
  revalidatePath("/", "layout");
  return { ok: true, message: t("replied") };
}
