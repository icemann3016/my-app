"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { SelectField } from "@/components/forms/text-field";
import { VOLUME_UNITS, type VolumeUnit } from "@/lib/domain/units";

const isVolumeUnit = (v: unknown): v is VolumeUnit => VOLUME_UNITS.includes(v as VolumeUnit);

/**
 * The unit fuel is entered in (L or US gal), picked per form; the server converts to litres.
 * Starts at the value sent back after an error, else the user's preference.
 */
export function useFuelUnit(idPrefix: string, initial: string | undefined, fallback: VolumeUnit) {
  const t = useTranslations("flightLog");
  const [first] = useState<VolumeUnit>(isVolumeUnit(initial) ? initial : fallback);
  const [unit, setUnit] = useState(first);
  const select = (
    <SelectField
      id={`${idPrefix}-fuel-unit`}
      name="fuelUnit"
      label={t("fuelUnit")}
      defaultValue={first}
      onChange={(event) => {
        const picked = event.target.value;
        if (!isVolumeUnit(picked)) return;
        // React resets the form after an action, which puts a <select> back on its default
        // option: make the picked unit the default so it survives (labels follow the state).
        for (const option of event.target.options) option.defaultSelected = option.value === picked;
        setUnit(picked);
      }}
      options={VOLUME_UNITS.map((u) => ({ value: u, label: t(`units.${u}`) }))}
    />
  );
  return { unit, label: t(`units.${unit}`), select };
}
