"use client";

import { useActionState, useState } from "react";
import { ReplyIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { replyToReviewAction } from "@/app/(app)/bookings/[id]/review-actions";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextAreaField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { type FormState, initialFormState } from "@/lib/forms";

/** The owner's one public reply to a review of their aircraft (RAT-5). */
export function ReplyDialog({ reviewId }: { reviewId: string }) {
  const t = useTranslations("reviews");
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await replyToReviewAction(prev, formData);
    if (result.ok) setOpen(false);
    return result;
  }, initialFormState);
  const v = state.ok ? {} : (state.values ?? {});
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 justify-self-start px-2 text-xs">
          <ReplyIcon aria-hidden /> {t("reply")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("replyTitle")}</DialogTitle>
          <DialogDescription>{t("replyHint")}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          {!state.ok && <FormMessage state={state} />}
          <input type="hidden" name="reviewId" value={reviewId} />
          <TextAreaField
            id={`reply-${reviewId.slice(0, 8)}`}
            name="text"
            label={t("replyLabel")}
            maxLength={1000}
            rows={4}
            defaultValue={v.text}
            errors={state.errors?.text}
            required
          />
          <SubmitButton className="justify-self-start" pendingText={t("sending")}>
            {t("sendReply")}
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
