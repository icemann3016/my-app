"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { DocumentField, type UploadedDocument } from "@/components/document-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextField } from "@/components/forms/text-field";
import { initialFormState } from "@/lib/forms";
import { saveCheckout } from "./actions";

/** Readings at check-out (BKG-7): meters, fuel and oil on board, optional photo. */
export function CheckoutForm({
  bookingId,
  logId,
  values,
  photo,
  fuelUnit,
  oilUnit,
}: {
  bookingId: string;
  logId: string;
  values: Record<string, string>;
  photo: UploadedDocument | null;
  fuelUnit: string;
  oilUnit: string;
}) {
  const t = useTranslations("flightLog");
  const [state, formAction] = useActionState(saveCheckout, initialFormState);
  const v = { ...values, ...state.values };
  const e = state.errors ?? {};
  return (
    <form action={formAction} className="grid gap-4">
      <FormMessage state={state} />
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="logId" value={logId} />
      <div className="grid grid-cols-2 gap-4">
        <TextField
          name="hobbsStart"
          inputMode="decimal"
          label={t("hobbs")}
          defaultValue={v.hobbsStart}
          errors={e.hobbsStart}
        />
        <TextField
          name="tachStart"
          inputMode="decimal"
          label={t("tach")}
          defaultValue={v.tachStart}
          errors={e.tachStart}
        />
        <TextField
          name="fuelStart"
          inputMode="decimal"
          label={t("fuelOnBoard", { unit: fuelUnit })}
          defaultValue={v.fuelStart}
          errors={e.fuelStart}
        />
        <TextField
          name="oilStart"
          inputMode="decimal"
          label={t("oilLevel", { unit: oilUnit })}
          defaultValue={v.oilStart}
          errors={e.oilStart}
        />
      </div>
      <DocumentField
        name="checkoutPhotoId"
        label={t("checkoutPhoto")}
        hint={t("checkoutPhotoHint")}
        initial={photo}
        errors={e.checkoutPhotoId}
      />
      <SubmitButton variant="outline" className="justify-self-start" pendingText={t("saving")}>
        {t("saveCheckout")}
      </SubmitButton>
    </form>
  );
}
