"use client";

import { useActionState } from "react";
import { XIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextField } from "@/components/forms/text-field";
import { initialFormState } from "@/lib/forms";
import { deleteTypeHours, saveExperience, saveTypeHours } from "./actions";

export function ExperienceForm(props: {
  totalHours: string;
  picHours: string;
  last90DaysHours: string;
  birthDate: string;
}) {
  const t = useTranslations("pilot.experience");
  const [state, formAction] = useActionState(saveExperience, initialFormState);
  const v = state.values ?? props;

  return (
    <form action={formAction} className="grid gap-4">
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-3">
        {(["totalHours", "picHours", "last90DaysHours"] as const).map((name) => (
          <TextField
            key={name}
            name={name}
            label={t(name)}
            type="number"
            inputMode="decimal"
            min={0}
            step={0.1}
            defaultValue={v[name]}
            errors={state.errors?.[name]}
            required
          />
        ))}
      </div>
      <TextField
        name="birthDate"
        type="date"
        label={t("birthDate")}
        hint={t("birthDateHint")}
        defaultValue={v.birthDate}
        errors={state.errors?.birthDate}
        className="sm:max-w-56"
      />
      <SubmitButton variant="outline" className="justify-self-start" pendingText={t("saving")}>
        {t("save")}
      </SubmitButton>
    </form>
  );
}

export function TypeHours({ rows }: { rows: { aircraftType: string; hours: number }[] }) {
  const t = useTranslations("pilot.experience");
  const [state, formAction] = useActionState(saveTypeHours, initialFormState);

  return (
    <div className="grid gap-3">
      <h3 className="text-sm font-medium">{t("byType")}</h3>
      {rows.length ? (
        <ul className="flex flex-wrap gap-2">
          {rows.map((r) => (
            <li
              key={r.aircraftType}
              className="flex items-center gap-1 rounded-md border py-1 pr-1 pl-2.5 text-sm"
            >
              <span className="font-mono">{r.aircraftType}</span>
              <span className="text-muted-foreground">· {t("hoursValue", { hours: r.hours })}</span>
              <form action={deleteTypeHours}>
                <input type="hidden" name="aircraftType" value={r.aircraftType} />
                <SubmitButton
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  aria-label={t("removeType", { type: r.aircraftType })}
                >
                  <XIcon aria-hidden />
                </SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t("noTypes")}</p>
      )}
      <form
        key={rows.length}
        action={formAction}
        className="grid grid-cols-[1fr_1fr_auto] items-start gap-2 sm:max-w-md"
      >
        <TextField
          name="aircraftType"
          label={t("type")}
          placeholder="C172"
          maxLength={6}
          autoCapitalize="characters"
          autoComplete="off"
          errors={state.errors?.aircraftType}
          required
        />
        <TextField
          name="hours"
          label={t("hours")}
          type="number"
          inputMode="decimal"
          min={0}
          step={0.1}
          errors={state.errors?.hours}
          required
        />
        <SubmitButton variant="outline" className="mt-[1.375rem]">
          {t("addType")}
        </SubmitButton>
      </form>
    </div>
  );
}
