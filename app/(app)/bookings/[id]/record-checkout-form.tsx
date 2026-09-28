"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextField } from "@/components/forms/text-field";
import { initialFormState } from "@/lib/forms";
import { recordCheckout } from "./checkout-actions";

/** The owner records the checkout flight: date, instructor, note (BKG-10). */
export function RecordCheckoutForm({
  bookingId,
  defaultDate,
}: {
  bookingId: string;
  defaultDate: string;
}) {
  const t = useTranslations("checkoutFlight");
  const [state, formAction] = useActionState(recordCheckout, initialFormState);
  const v = state.values ?? {};
  const e = state.errors ?? {};
  return (
    <form action={formAction} className="grid gap-4">
      <FormMessage state={state} />
      <input type="hidden" name="bookingId" value={bookingId} />
      <p className="text-sm text-muted-foreground">{t("recordHint")}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="doneOn"
          type="date"
          label={t("doneOn")}
          defaultValue={v.doneOn ?? defaultDate}
          errors={e.doneOn}
          required
        />
        <TextField
          name="instructor"
          label={t("instructor")}
          maxLength={100}
          defaultValue={v.instructor}
          errors={e.instructor}
        />
      </div>
      <TextField
        name="note"
        label={t("note")}
        maxLength={500}
        defaultValue={v.note}
        errors={e.note}
      />
      <SubmitButton className="justify-self-start" pendingText={t("saving")}>
        {t("record")}
      </SubmitButton>
    </form>
  );
}
