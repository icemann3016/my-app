"use client";

import { useActionState } from "react";
import { CircleSlashIcon, TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextAreaField } from "@/components/forms/text-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { initialFormState } from "@/lib/forms";
import { cancelBookingAction } from "./actions";

/** Cancel a booking with a reason; warns when it would count as a late cancellation (BKG-6). */
export function CancelBooking({
  bookingId,
  policyText,
  late,
}: {
  bookingId: string;
  /** e.g. "Moderate: free cancellation up to 3 days before the booking." */
  policyText: string;
  /** Cancelling now would be recorded as late. */
  late: boolean;
}) {
  const t = useTranslations("booking.cancel");
  const [state, formAction] = useActionState(cancelBookingAction, initialFormState);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="justify-self-start text-destructive">
          <CircleSlashIcon aria-hidden /> {t("button")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{policyText}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          <FormMessage state={state} />
          {late && (
            <Alert variant="destructive">
              <TriangleAlertIcon />
              <AlertDescription>{t("lateWarning")}</AlertDescription>
            </Alert>
          )}
          <input type="hidden" name="bookingId" value={bookingId} />
          <TextAreaField
            name="reason"
            label={t("reason")}
            maxLength={500}
            rows={3}
            required
            defaultValue={state.values?.reason}
            errors={state.errors?.reason}
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {t("keep")}
              </Button>
            </DialogClose>
            <SubmitButton variant="destructive" pendingText={t("cancelling")}>
              {t("confirm")}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
