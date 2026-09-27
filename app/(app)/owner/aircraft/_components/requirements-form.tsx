"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { SelectField, TextField } from "@/components/forms/text-field";
import { UNRATED_POLICIES } from "@/lib/aircraft/catalog";
import { type FormState, initialFormState } from "@/lib/forms";
import { CLASS_RATINGS, LICENCE_LABELS, LICENCE_TYPES, PRIVILEGES } from "@/lib/pilot/catalog";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export type RequirementValues = {
  minPilotRating: string;
  minReviews: string;
  unratedPolicy: string;
  licenceTypes: string[];
  requiredRatings: string[];
  minTotalHours: string;
  minTypeHours: string;
  min90DayHours: string;
  minAge: string;
};

const PICKABLE = new Set<string>([...CLASS_RATINGS, ...PRIVILEGES]);

function CheckboxGroup({
  legend,
  hint,
  name,
  options,
  checked,
}: {
  legend: string;
  hint?: string;
  name: string;
  options: { value: string; label: string }[];
  checked: string[];
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-medium">{legend}</legend>
      {hint && <p className="-mt-1 text-xs text-muted-foreground">{hint}</p>}
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {options.map((o) => (
          <label key={o.value} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name={name}
              value={o.value}
              defaultChecked={checked.includes(o.value)}
              className="size-4 accent-primary"
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function RequirementsForm({
  action,
  values,
  icaoType,
}: {
  action: Action;
  values: RequirementValues;
  icaoType: string | null;
}) {
  const t = useTranslations("owner.requirements");
  const tp = useTranslations("pilot");
  const [state, formAction] = useActionState(action, initialFormState);
  const e = state.errors ?? {};
  // After an error the form shows what was sent; checkbox groups come back from the initial values.
  const v = { ...values, ...(state.values as Partial<RequirementValues> | undefined) };
  const typeRatings = values.requiredRatings.filter((r) => !PICKABLE.has(r)).join(", ");

  return (
    <form action={formAction} className="grid gap-6">
      <FormMessage state={state} />

      <fieldset className="grid gap-4">
        <legend className="mb-2 font-medium">{t("ratingTitle")}</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField
            name="minPilotRating"
            label={t("minPilotRating")}
            hint={t("minPilotRatingHint")}
            type="number"
            inputMode="decimal"
            min={1}
            max={5}
            step={0.1}
            defaultValue={v.minPilotRating}
            errors={e.minPilotRating}
          />
          <TextField
            name="minReviews"
            label={t("minReviews")}
            hint={t("minReviewsHint")}
            type="number"
            inputMode="numeric"
            min={1}
            max={50}
            defaultValue={v.minReviews}
            errors={e.minReviews}
          />
          <SelectField
            name="unratedPolicy"
            label={t("unratedPolicy")}
            defaultValue={v.unratedPolicy}
            errors={e.unratedPolicy}
            options={UNRATED_POLICIES.map((p) => ({ value: p, label: t(`unrated.${p}`) }))}
          />
        </div>
      </fieldset>

      <CheckboxGroup
        legend={t("licenceTypes")}
        hint={t("licenceTypesHint")}
        name="licenceTypes"
        checked={values.licenceTypes}
        options={LICENCE_TYPES.map((l) => ({
          value: l,
          label: LICENCE_LABELS[l] ?? tp("licences.other"),
        }))}
      />
      <CheckboxGroup
        legend={t("classRatings")}
        name="requiredRatings"
        checked={values.requiredRatings}
        options={CLASS_RATINGS.map((c) => ({ value: c, label: tp(`classRatings.${c}`) }))}
      />
      <CheckboxGroup
        legend={t("privileges")}
        hint={t("privilegesHint")}
        name="requiredRatings"
        checked={values.requiredRatings}
        options={PRIVILEGES.map((p) => ({ value: p, label: tp(`privileges.${p}`) }))}
      />
      <TextField
        name="typeRatings"
        label={t("typeRatings")}
        hint={t("typeRatingsHint")}
        placeholder="C510"
        defaultValue={(state.values?.typeRatings as string | undefined) ?? typeRatings}
        errors={e.typeRatings}
        autoCapitalize="characters"
        autoComplete="off"
      />

      <fieldset className="grid gap-4">
        <legend className="mb-2 font-medium">{t("experienceTitle")}</legend>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TextField
            name="minTotalHours"
            label={t("minTotalHours")}
            type="number"
            inputMode="decimal"
            min={0}
            step={1}
            defaultValue={v.minTotalHours}
            errors={e.minTotalHours}
          />
          <TextField
            name="minTypeHours"
            label={icaoType ? t("minTypeHoursOn", { type: icaoType }) : t("minTypeHours")}
            type="number"
            inputMode="decimal"
            min={0}
            step={1}
            defaultValue={v.minTypeHours}
            errors={e.minTypeHours}
          />
          <TextField
            name="min90DayHours"
            label={t("min90DayHours")}
            type="number"
            inputMode="decimal"
            min={0}
            step={0.5}
            defaultValue={v.min90DayHours}
            errors={e.min90DayHours}
          />
          <TextField
            name="minAge"
            label={t("minAge")}
            type="number"
            inputMode="numeric"
            min={16}
            max={99}
            defaultValue={v.minAge}
            errors={e.minAge}
          />
        </div>
        <p className="text-xs text-muted-foreground">{t("emptyMeansNone")}</p>
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <SubmitButton name="intent" value="next" pendingText={t("saving")}>
          {t("saveAndReview")}
        </SubmitButton>
        <SubmitButton name="intent" value="stay" variant="outline" pendingText={t("saving")}>
          {t("save")}
        </SubmitButton>
      </div>
    </form>
  );
}
