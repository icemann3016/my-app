"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { CheckboxField } from "@/components/forms/checkbox-field";
import { FormMessage } from "@/components/forms/form-message";
import { SelectField, TextField } from "@/components/forms/text-field";
import { TRANSPONDERS } from "@/lib/aircraft/catalog";
import { initialFormState } from "@/lib/forms";
import { saveEquipment } from "./actions";
import { SectionFooter } from "./section-footer";

/** Avionics and capabilities (LST-2). */
export function EquipmentForm({
  values,
  isDraft,
}: {
  values: Record<string, string>;
  isDraft: boolean;
}) {
  const t = useTranslations("aircraft");
  const [state, formAction] = useActionState(saveEquipment, initialFormState);
  // Unticked checkboxes aren't sent, so after an error only the sent values count.
  const v = state.values ?? values;
  const e = state.errors ?? {};

  return (
    <form action={formAction} className="grid gap-4">
      <FormMessage state={state} />
      <input type="hidden" name="id" value={values.id} />
      <TextField
        name="avionics"
        label={t("fields.avionics")}
        hint={t("fields.avionicsHint")}
        placeholder="Garmin G1000 NXi, GFC 700"
        defaultValue={v.avionics}
        errors={e.avionics}
        maxLength={300}
      />
      <SelectField
        name="transponder"
        label={t("fields.transponder")}
        defaultValue={v.transponder ?? "mode_s"}
        errors={e.transponder}
        options={TRANSPONDERS.map((x) => ({ value: x, label: t(`transponders.${x}`) }))}
      />
      <fieldset className="grid gap-3">
        <legend className="mb-2 text-sm font-medium">{t("fields.capabilities")}</legend>
        <CheckboxField
          name="autopilot"
          label={t("fields.autopilot")}
          defaultChecked={v.autopilot === "on"}
        />
        <CheckboxField
          name="nightVfr"
          label={t("fields.nightVfr")}
          defaultChecked={v.nightVfr === "on"}
          errors={e.nightVfr}
        />
        <CheckboxField
          name="ifr"
          label={t("fields.ifr")}
          hint={t("fields.ifrHint")}
          defaultChecked={v.ifr === "on"}
        />
      </fieldset>
      <SectionFooter continues={isDraft} />
    </form>
  );
}
