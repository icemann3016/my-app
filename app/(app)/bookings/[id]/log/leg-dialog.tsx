"use client";

import { useActionState, useState } from "react";
import { PencilIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { AirportPicker, type PickerAirport } from "@/components/airport-picker";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LEG_TIME_FIELDS } from "@/lib/domain/leg-times";
import { type VolumeUnit } from "@/lib/domain/units";
import { type FormState, initialFormState } from "@/lib/forms";
import { saveLeg } from "./actions";
import { useFuelUnit } from "./fuel-unit";

const OPTIONAL = new Set(["takeoff", "landing"]);

/** Add or edit a leg: airfields, UTC times, landings, meters, fuel and oil (BKG-12…14). */
export function LegDialog({
  bookingId,
  logId,
  values,
  from,
  to,
  fuelUnit,
  oilUnit,
  label,
}: {
  bookingId: string;
  logId: string;
  /** Local date/clock times and readings as strings; `legId` when editing. */
  values: Record<string, string>;
  from: PickerAirport | null;
  to: PickerAirport | null;
  fuelUnit: VolumeUnit;
  oilUnit: string;
  label?: string;
}) {
  const t = useTranslations("flightLog");
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await saveLeg(prev, formData);
    if (result.ok) setOpen(false);
    return result;
  }, initialFormState);
  const v = { ...values, ...state.values };
  const e = state.errors ?? {};
  const editing = Boolean(values.legId);
  const fuel = useFuelUnit("leg", v.fuelUnit, fuelUnit);
  const number = (name: string, text: string) => (
    <TextField
      key={name}
      id={`leg-${name}`}
      name={name}
      inputMode="decimal"
      label={text}
      defaultValue={v[name]}
      errors={e[name]}
    />
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {editing ? (
          <Button variant="ghost" size="sm" aria-label={label}>
            <PencilIcon aria-hidden /> {t("edit")}
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <PlusIcon aria-hidden /> {t("addLeg")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? t("editLeg") : t("addLeg")}</DialogTitle>
          <DialogDescription>{t("legHint")}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          <FormMessage state={state} />
          <input type="hidden" name="bookingId" value={bookingId} />
          <input type="hidden" name="logId" value={logId} />
          {editing && <input type="hidden" name="legId" value={values.legId} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <AirportPicker name="from" label={t("from")} defaultAirport={from} errors={e.from} />
            <AirportPicker name="to" label={t("to")} defaultAirport={to} errors={e.to} />
          </div>
          <TextField
            id="leg-date"
            name="date"
            type="date"
            label={t("date")}
            defaultValue={v.date}
            errors={e.date}
            required
          />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {LEG_TIME_FIELDS.map((name) => (
              <TextField
                key={name}
                id={`leg-${name}`}
                name={name}
                type="time"
                label={OPTIONAL.has(name) ? t("optional", { field: t(name) }) : t(name)}
                defaultValue={v[name]}
                errors={e[name]}
                required={!OPTIONAL.has(name)}
              />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <TextField
              id="leg-landings"
              name="landings"
              type="number"
              inputMode="numeric"
              min={1}
              label={t("landings")}
              defaultValue={v.landings ?? "1"}
              errors={e.landings}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            {number("hobbsStart", t("hobbsStart"))}
            {number("hobbsEnd", t("hobbsEnd"))}
            {number("tachStart", t("tachStart"))}
            {number("tachEnd", t("tachEnd"))}
            {fuel.select}
            <div />
            {number("fuelBefore", t("fuelBefore", { unit: fuel.label }))}
            {number("fuelAfter", t("fuelAfter", { unit: fuel.label }))}
            {number("oilBefore", t("oilBefore", { unit: oilUnit }))}
            {number("oilAfter", t("oilAfter", { unit: oilUnit }))}
          </div>
          <SubmitButton className="justify-self-start" pendingText={t("saving")}>
            {t("saveLeg")}
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
