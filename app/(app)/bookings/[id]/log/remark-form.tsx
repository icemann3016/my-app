"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { AirportPicker, type PickerAirport } from "@/components/airport-picker";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { SelectField, TextAreaField } from "@/components/forms/text-field";
import { initialFormState } from "@/lib/forms";
import { REMARK_KINDS } from "@/lib/validation/flight-log";
import { addRemark } from "./remark-actions";

/** Add a remark about the aircraft, or a note on the weather or an airfield (BKG-15). */
export function RemarkForm({
  bookingId,
  logId,
  airport,
}: {
  bookingId: string;
  logId: string;
  airport: PickerAirport | null;
}) {
  const t = useTranslations("flightLog.remarks");
  const [state, formAction] = useActionState(addRemark, initialFormState);
  // After a save the form is empty again; after an error it keeps what was typed.
  const v = state.ok ? {} : (state.values ?? {});
  const e = state.errors ?? {};
  return (
    <form action={formAction} className="grid gap-4 border-t pt-4">
      <FormMessage state={state} />
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="logId" value={logId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          id="remark-kind"
          name="kind"
          label={t("kind")}
          defaultValue={v.kind ?? "aircraft"}
          options={REMARK_KINDS.map((k) => ({ value: k, label: t(`kinds.${k}`) }))}
        />
        <AirportPicker
          name="airport"
          label={t("airport")}
          defaultAirport={airport}
          errors={e.airport}
        />
      </div>
      <TextAreaField
        id="remark-body"
        name="body"
        label={t("body")}
        hint={t("bodyHint")}
        maxLength={1000}
        rows={3}
        defaultValue={v.body}
        errors={e.body}
        required
      />
      <SubmitButton variant="outline" className="justify-self-start" pendingText={t("saving")}>
        {t("add")}
      </SubmitButton>
    </form>
  );
}
