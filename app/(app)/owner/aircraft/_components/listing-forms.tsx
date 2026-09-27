"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { AirportPicker, type PickerAirport } from "@/components/airport-picker";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { SelectField, TextAreaField, TextField } from "@/components/forms/text-field";
import {
  AIRCRAFT_CATEGORIES,
  CURRENCIES,
  FUEL_LABELS,
  FUEL_TYPES,
  OIL_UNITS,
  PRICE_BASES,
  TIME_BASES,
  TRANSPONDERS,
} from "@/lib/aircraft/catalog";
import { type FormState, initialFormState } from "@/lib/forms";
import type { Units } from "@/lib/units";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;
type Values = Record<string, string>;

function useSectionForm(action: Action, initial: Values) {
  const [state, formAction] = useActionState(action, initialFormState);
  return { state, formAction, v: { ...initial, ...state.values }, e: state.errors ?? {} };
}

/** "Save" and "Save and continue" (the action opens the next section for intent=next). */
function Footer({ last = false, create = false }: { last?: boolean; create?: boolean }) {
  const t = useTranslations("owner.editor");
  if (create) {
    return <SubmitButton pendingText={t("saving")}>{t("createDraft")}</SubmitButton>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      <SubmitButton name="intent" value="next" pendingText={t("saving")}>
        {last ? t("saveAndReview") : t("saveAndContinue")}
      </SubmitButton>
      <SubmitButton name="intent" value="stay" variant="outline" pendingText={t("saving")}>
        {t("save")}
      </SubmitButton>
    </div>
  );
}

function Checkbox({
  name,
  label,
  hint,
  defaultChecked,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 size-4 accent-primary"
      />
      <span className="grid gap-0.5">
        <span className="font-medium">{label}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

export function DetailsForm({
  action,
  values,
  units,
  registrationLocked = false,
  create = false,
}: {
  action: Action;
  values: Values;
  units: Units;
  registrationLocked?: boolean;
  create?: boolean;
}) {
  const t = useTranslations("owner.details");
  const ta = useTranslations("aircraft");
  const { state, formAction, v, e } = useSectionForm(action, values);
  const volume = units === "imperial" ? ta("units.usgalPerHour") : ta("units.litresPerHour");
  const mass = units === "imperial" ? ta("units.lb") : ta("units.kg");

  return (
    <form action={formAction} className="grid gap-5">
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="registration"
          label={t("registration")}
          hint={registrationLocked ? t("registrationLocked") : t("registrationHint")}
          defaultValue={v.registration}
          errors={e.registration}
          readOnly={registrationLocked}
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={12}
          required
        />
        <SelectField
          name="category"
          label={t("category")}
          defaultValue={v.category ?? "aeroplane"}
          errors={e.category}
          options={AIRCRAFT_CATEGORIES.map((c) => ({ value: c, label: ta(`categories.${c}`) }))}
        />
        <TextField
          name="manufacturer"
          label={t("manufacturer")}
          placeholder="Cessna"
          defaultValue={v.manufacturer}
          errors={e.manufacturer}
          maxLength={60}
        />
        <TextField
          name="model"
          label={t("model")}
          placeholder="172S Skyhawk"
          defaultValue={v.model}
          errors={e.model}
          maxLength={60}
        />
        <TextField
          name="icaoType"
          label={t("icaoType")}
          hint={t("icaoTypeHint")}
          placeholder="C172"
          defaultValue={v.icaoType}
          errors={e.icaoType}
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={4}
        />
        <div className="grid grid-cols-2 gap-4">
          <TextField
            name="year"
            label={t("year")}
            type="number"
            inputMode="numeric"
            min={1903}
            max={2100}
            defaultValue={v.year}
            errors={e.year}
          />
          <TextField
            name="seats"
            label={t("seats")}
            type="number"
            inputMode="numeric"
            min={1}
            max={20}
            defaultValue={v.seats}
            errors={e.seats}
          />
        </div>
      </div>

      <fieldset className="grid gap-4">
        <legend className="mb-2 text-sm font-medium">{t("performance")}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            name="engine"
            label={t("engine")}
            placeholder="Lycoming IO-360-L2A, 180 hp"
            defaultValue={v.engine}
            errors={e.engine}
            maxLength={100}
          />
          <SelectField
            name="fuelType"
            label={t("fuelType")}
            defaultValue={v.fuelType ?? ""}
            errors={e.fuelType}
            options={[
              { value: "", label: t("choose") },
              ...FUEL_TYPES.map((f) => ({ value: f, label: FUEL_LABELS[f] })),
            ]}
          />
          <TextField
            name="fuelBurn"
            label={`${t("fuelBurn")} (${volume})`}
            type="number"
            inputMode="decimal"
            min={0}
            step={0.1}
            defaultValue={v.fuelBurn}
            errors={e.fuelBurn}
          />
          <TextField
            name="cruiseKt"
            label={`${t("cruise")} (${ta("units.kt")})`}
            type="number"
            inputMode="numeric"
            min={0}
            defaultValue={v.cruiseKt}
            errors={e.cruiseKt}
          />
          <TextField
            name="usefulLoad"
            label={`${t("usefulLoad")} (${mass})`}
            type="number"
            inputMode="numeric"
            min={0}
            defaultValue={v.usefulLoad}
            errors={e.usefulLoad}
          />
          <TextField
            name="enduranceH"
            label={`${t("endurance")} (${ta("units.h")})`}
            type="number"
            inputMode="decimal"
            min={0}
            step={0.1}
            defaultValue={v.enduranceH}
            errors={e.enduranceH}
          />
          <SelectField
            name="oilUnit"
            label={t("oilUnit")}
            hint={t("oilUnitHint")}
            defaultValue={v.oilUnit ?? "us_qt"}
            errors={e.oilUnit}
            options={OIL_UNITS.map((u) => ({ value: u, label: ta(`oilUnits.${u}`) }))}
          />
        </div>
      </fieldset>
      <Footer create={create} />
    </form>
  );
}

export function EquipmentForm({ action, values }: { action: Action; values: Values }) {
  const t = useTranslations("owner.equipment");
  const ta = useTranslations("aircraft");
  const { state, formAction, v, e } = useSectionForm(action, values);
  return (
    <form action={formAction} className="grid gap-5">
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="avionics"
          label={t("avionics")}
          placeholder="Garmin G1000 NXi"
          defaultValue={v.avionics}
          errors={e.avionics}
          maxLength={200}
        />
        <SelectField
          name="transponder"
          label={t("transponder")}
          defaultValue={v.transponder ?? "mode_s"}
          errors={e.transponder}
          options={TRANSPONDERS.map((x) => ({ value: x, label: ta(`transponders.${x}`) }))}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Checkbox name="autopilot" label={t("autopilot")} defaultChecked={v.autopilot === "on"} />
        <Checkbox name="adsbOut" label={t("adsbOut")} defaultChecked={v.adsbOut === "on"} />
        <Checkbox
          name="nightVfr"
          label={t("nightVfr")}
          hint={t("nightVfrHint")}
          defaultChecked={v.nightVfr === "on"}
        />
        <Checkbox name="ifr" label={t("ifr")} hint={t("ifrHint")} defaultChecked={v.ifr === "on"} />
      </div>
      <TextAreaField
        name="equipmentNotes"
        label={t("notes")}
        placeholder={t("notesPlaceholder")}
        defaultValue={v.equipmentNotes}
        errors={e.equipmentNotes}
        maxLength={1000}
        rows={3}
      />
      <TextAreaField
        name="description"
        label={t("description")}
        hint={t("descriptionHint")}
        defaultValue={v.description}
        errors={e.description}
        maxLength={4000}
        rows={6}
      />
      <Footer />
    </form>
  );
}

export function BaseForm({ action, airport }: { action: Action; airport: PickerAirport | null }) {
  const t = useTranslations("owner.base");
  const { state, formAction, e } = useSectionForm(action, {});
  return (
    <form action={formAction} className="grid gap-5">
      <FormMessage state={state} />
      <AirportPicker
        name="homeAirportIdent"
        label={t("homeBase")}
        hint={t("homeBaseHint")}
        defaultAirport={airport}
        errors={e.homeAirportIdent}
      />
      <Footer />
    </form>
  );
}

export function PricingForm({ action, values }: { action: Action; values: Values }) {
  const t = useTranslations("owner.pricing");
  const ta = useTranslations("aircraft");
  const { state, formAction, v, e } = useSectionForm(action, values);
  return (
    <form action={formAction} className="grid gap-5">
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField
          name="pricePerHour"
          label={t("pricePerHour")}
          type="number"
          inputMode="decimal"
          min={0}
          step={0.01}
          defaultValue={v.pricePerHour}
          errors={e.pricePerHour}
        />
        <SelectField
          name="currency"
          label={t("currency")}
          defaultValue={v.currency ?? "EUR"}
          errors={e.currency}
          options={CURRENCIES.map((c) => ({ value: c, label: c }))}
        />
        <TextField
          name="weekendPricePerHour"
          label={t("weekendPrice")}
          hint={t("weekendPriceHint")}
          type="number"
          inputMode="decimal"
          min={0}
          step={0.01}
          defaultValue={v.weekendPricePerHour}
          errors={e.weekendPricePerHour}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField
          name="priceBasis"
          label={t("priceBasis")}
          defaultValue={v.priceBasis ?? "wet"}
          errors={e.priceBasis}
          options={PRICE_BASES.map((b) => ({ value: b, label: ta(`priceBases.${b}`) }))}
        />
        <SelectField
          name="timeBasis"
          label={t("timeBasis")}
          hint={t("timeBasisHint")}
          defaultValue={v.timeBasis ?? "hobbs"}
          errors={e.timeBasis}
          options={TIME_BASES.map((b) => ({ value: b, label: ta(`timeBases.${b}`) }))}
        />
        <TextField
          name="minHoursPerDay"
          label={t("minHoursPerDay")}
          hint={t("minHoursPerDayHint")}
          type="number"
          inputMode="decimal"
          min={0}
          max={24}
          step={0.5}
          defaultValue={v.minHoursPerDay}
          errors={e.minHoursPerDay}
        />
      </div>
      <fieldset className="grid gap-4">
        <legend className="mb-2 text-sm font-medium">{t("cancellation")}</legend>
        <TextField
          name="freeCancellationHours"
          label={t("freeCancellationHours")}
          hint={t("freeCancellationHoursHint")}
          type="number"
          inputMode="numeric"
          min={0}
          max={720}
          defaultValue={v.freeCancellationHours ?? "24"}
          errors={e.freeCancellationHours}
          className="sm:max-w-40"
        />
        <TextAreaField
          name="cancellationNote"
          label={t("cancellationNote")}
          placeholder={t("cancellationNotePlaceholder")}
          defaultValue={v.cancellationNote}
          errors={e.cancellationNote}
          maxLength={500}
          rows={3}
        />
      </fieldset>
      <Footer />
    </form>
  );
}
