"use client";

import { useActionState, useState } from "react";
import { CalendarClockIcon, CheckIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextAreaField, TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import { initialFormState } from "@/lib/forms";
import { answerBooking } from "./actions";

/** Accept, decline or suggest another time for a booking request (owner, BKG-3). */
export function RespondForm({ bookingId }: { bookingId: string }) {
  const t = useTranslations("booking.respond");
  const [state, formAction] = useActionState(answerBooking, initialFormState);
  const [proposing, setProposing] = useState(false);
  const e = state.errors ?? {};

  return (
    <form action={formAction} className="grid gap-4">
      <FormMessage state={state} />
      <input type="hidden" name="bookingId" value={bookingId} />
      <TextAreaField
        name="note"
        label={t("note")}
        placeholder={t("notePlaceholder")}
        maxLength={500}
        rows={2}
        defaultValue={state.values?.note}
        errors={e.note}
      />
      {proposing && (
        <div className="grid gap-4 rounded-md border p-3">
          <p className="text-sm">{t("proposeText")}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              name="proposeFrom"
              type="datetime-local"
              label={t("from")}
              errors={e.proposeFrom}
              required
            />
            <TextField
              name="proposeTo"
              type="datetime-local"
              label={t("to")}
              errors={e.proposeTo}
              required
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <SubmitButton name="decision" value="propose" pendingText={t("sending")}>
              <CalendarClockIcon aria-hidden /> {t("sendProposal")}
            </SubmitButton>
            <Button type="button" variant="ghost" onClick={() => setProposing(false)}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      )}
      {!proposing && (
        <div className="flex flex-wrap gap-2">
          <SubmitButton name="decision" value="accept" pendingText={t("sending")}>
            <CheckIcon aria-hidden /> {t("accept")}
          </SubmitButton>
          <SubmitButton
            name="decision"
            value="decline"
            variant="outline"
            pendingText={t("sending")}
          >
            <XIcon aria-hidden /> {t("decline")}
          </SubmitButton>
          <Button type="button" variant="ghost" onClick={() => setProposing(true)}>
            <CalendarClockIcon aria-hidden /> {t("propose")}
          </Button>
        </div>
      )}
    </form>
  );
}
