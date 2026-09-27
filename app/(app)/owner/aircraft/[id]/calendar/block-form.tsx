"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { SelectField, TextField } from "@/components/forms/text-field";
import { initialFormState } from "@/lib/forms";
import { addCalendarBlock } from "./actions";

const KINDS = ["owner_use", "maintenance", "unavailable"] as const;

/** Block time on the calendar, in the home base's local time. */
export function BlockForm({ aircraftId, timeZone }: { aircraftId: string; timeZone: string }) {
  const t = useTranslations("aircraft.calendar");
  const [state, formAction] = useActionState(addCalendarBlock, initialFormState);
  // After a successful save the form starts empty again.
  const v = state.ok ? {} : (state.values ?? {});
  const e = state.errors ?? {};

  return (
    <form action={formAction} className="grid gap-4">
      <FormMessage state={state} />
      <input type="hidden" name="aircraftId" value={aircraftId} />
      <SelectField
        name="kind"
        label={t("kind")}
        defaultValue={v.kind ?? "owner_use"}
        errors={e.kind}
        options={KINDS.map((k) => ({ value: k, label: t(`kinds.${k}`) }))}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="from"
          type="datetime-local"
          label={t("from")}
          defaultValue={v.from}
          errors={e.from}
          required
        />
        <TextField
          name="to"
          type="datetime-local"
          label={t("to")}
          defaultValue={v.to}
          errors={e.to}
          required
        />
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">{t("localHint", { zone: timeZone })}</p>
      <TextField
        name="note"
        label={t("note")}
        placeholder={t("notePlaceholder")}
        defaultValue={v.note}
        errors={e.note}
        maxLength={200}
      />
      <SubmitButton className="justify-self-start" pendingText={t("adding")}>
        {t("add")}
      </SubmitButton>
    </form>
  );
}
