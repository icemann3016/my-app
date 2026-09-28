"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { submitReviewAction } from "@/app/(app)/bookings/[id]/review-actions";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextAreaField } from "@/components/forms/text-field";
import type { ReviewDirection } from "@/lib/db/schema";
import { initialFormState } from "@/lib/forms";
import { REVIEW_CATEGORIES } from "@/lib/reviews/categories";
import { StarInput } from "./star-input";

/** Review the other side of a completed booking: a score per category and a comment (RAT-1, RAT-2). */
export function ReviewForm({
  bookingId,
  direction,
}: {
  bookingId: string;
  direction: ReviewDirection;
}) {
  const t = useTranslations("reviews");
  const [state, formAction] = useActionState(submitReviewAction, initialFormState);
  const v = state.values ?? {};
  const e = state.errors ?? {};
  return (
    <form action={formAction} className="grid gap-4">
      <FormMessage state={state} />
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="direction" value={direction} />
      {REVIEW_CATEGORIES[direction].map((c) => (
        <StarInput
          key={c}
          name={`score_${c}`}
          label={t(`categories.${c}.label`)}
          hint={t(`categories.${c}.hint`)}
          defaultValue={v[`score_${c}`]}
          errors={e[`score_${c}`]}
        />
      ))}
      <TextAreaField
        id="review-comment"
        name="comment"
        label={t("comment")}
        hint={t(direction === "pilot_to_owner" ? "commentHintPilot" : "commentHintOwner")}
        maxLength={2000}
        rows={4}
        defaultValue={v.comment}
        errors={e.comment}
      />
      <SubmitButton className="justify-self-start" pendingText={t("sending")}>
        {t("send")}
      </SubmitButton>
    </form>
  );
}
