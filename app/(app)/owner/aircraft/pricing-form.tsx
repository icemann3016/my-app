"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { FormMessage } from "@/components/forms/form-message";
import { SelectField, TextField } from "@/components/forms/text-field";
import {
  CANCELLATION_POLICIES,
  CURRENCIES,
  OIL_UNITS,
  PRICE_BASES,
  TIME_BASES,
} from "@/lib/aircraft/catalog";
import { initialFormState } from "@/lib/forms";
import { savePricing } from "./actions";
import { SectionFooter } from "./section-footer";

/** Price per hour, wet/dry, how time is measured and rental terms (LST-5). */
export function PricingForm({
  values,
  isDraft,
}: {
  values: Record<string, string>;
  isDraft: boolean;
}) {
  const t = useTranslations("aircraft");
  const [state, formAction] = useActionState(savePricing, initialFormState);
  const v = { ...values, ...state.values };
  const e = state.errors ?? {};

  return (
    <form action={formAction} className="grid gap-4">
      <FormMessage state={state} />
      <input type="hidden" name="id" value={values.id} />
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <TextField
          name="pricePerHour"
          label={t("fields.pricePerHour")}
          inputMode="decimal"
          defaultValue={v.pricePerHour}
          errors={e.pricePerHour}
          required
        />
        <SelectField
          name="currency"
          label={t("fields.currency")}
          defaultValue={v.currency ?? "EUR"}
          errors={e.currency}
          options={CURRENCIES.map((c) => ({ value: c, label: c }))}
        />
      </div>
      <TextField
        name="weekendPricePerHour"
        label={t("fields.weekendPrice")}
        hint={t("fields.weekendPriceHint")}
        inputMode="decimal"
        defaultValue={v.weekendPricePerHour}
        errors={e.weekendPricePerHour}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          name="priceBasis"
          label={t("fields.priceBasis")}
          defaultValue={v.priceBasis ?? "wet"}
          errors={e.priceBasis}
          options={PRICE_BASES.map((b) => ({ value: b, label: t(`priceBases.${b}`) }))}
        />
        <SelectField
          name="timeBasis"
          label={t("fields.timeBasis")}
          hint={t("fields.timeBasisHint")}
          defaultValue={v.timeBasis ?? "hobbs"}
          errors={e.timeBasis}
          options={TIME_BASES.map((b) => ({ value: b, label: t(`timeBases.${b}`) }))}
        />
        <TextField
          name="minHoursPerDay"
          label={t("fields.minHoursPerDay")}
          hint={t("fields.minHoursPerDayHint")}
          inputMode="decimal"
          defaultValue={v.minHoursPerDay}
          errors={e.minHoursPerDay}
        />
        <SelectField
          name="oilUnit"
          label={t("fields.oilUnit")}
          hint={t("fields.oilUnitHint")}
          defaultValue={v.oilUnit ?? "qt"}
          errors={e.oilUnit}
          options={OIL_UNITS.map((u) => ({ value: u, label: t(`oilUnits.${u}`) }))}
        />
      </div>
      <SelectField
        name="cancellationPolicy"
        label={t("fields.cancellationPolicy")}
        defaultValue={v.cancellationPolicy ?? "moderate"}
        errors={e.cancellationPolicy}
        options={CANCELLATION_POLICIES.map((p) => ({
          value: p,
          label: t(`cancellation.${p}.label`),
        }))}
      />
      <ul className="grid gap-1 text-xs text-muted-foreground">
        {CANCELLATION_POLICIES.map((p) => (
          <li key={p}>
            <span className="font-medium text-foreground">{t(`cancellation.${p}.label`)}:</span>{" "}
            {t(`cancellation.${p}.text`)}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">{t("fields.paymentNote")}</p>
      <SectionFooter continues={isDraft} />
    </form>
  );
}
