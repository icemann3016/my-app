"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { AirportPicker, type PickerAirport } from "@/components/airport-picker";
import { FormMessage } from "@/components/forms/form-message";
import { TextAreaField } from "@/components/forms/text-field";
import { initialFormState } from "@/lib/forms";
import { saveBase } from "./actions";
import { SectionFooter } from "./section-footer";

/** Home base and description (LST-3/4). */
export function BaseForm({
  values,
  homeAirport,
  isDraft,
}: {
  values: Record<string, string>;
  homeAirport: PickerAirport | null;
  isDraft: boolean;
}) {
  const t = useTranslations("aircraft");
  const [state, formAction] = useActionState(saveBase, initialFormState);
  const v = { ...values, ...state.values };

  return (
    <form action={formAction} className="grid gap-4">
      <FormMessage state={state} />
      <input type="hidden" name="id" value={values.id} />
      <AirportPicker
        name="homeAirport"
        label={t("fields.homeAirport")}
        hint={t("fields.homeAirportHint")}
        defaultAirport={homeAirport}
        errors={state.errors?.homeAirport}
      />
      <TextAreaField
        name="description"
        label={t("fields.description")}
        placeholder={t("fields.descriptionPlaceholder")}
        defaultValue={v.description}
        errors={state.errors?.description}
        maxLength={4000}
        rows={8}
      />
      <SectionFooter continues={isDraft} />
    </form>
  );
}
