"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Label } from "@/components/ui/label";
import { locales } from "@/lib/i18n/config";
import { initialFormState } from "@/lib/forms";
import { savePreferences } from "./actions";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

export function PreferencesForm(props: { locale: string; units: string }) {
  const t = useTranslations();
  const [state, formAction] = useActionState(savePreferences, initialFormState);
  const v = state.values ?? props;

  return (
    <form action={formAction} className="grid gap-4">
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="locale">{t("account.preferences.language")}</Label>
          <select id="locale" name="locale" defaultValue={v.locale} className={selectClass}>
            {locales.map((l) => (
              <option key={l} value={l}>
                {t(`common.languages.${l}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="units">{t("account.preferences.units")}</Label>
          <select id="units" name="units" defaultValue={v.units} className={selectClass}>
            <option value="metric">{t("account.preferences.metric")}</option>
            <option value="imperial">{t("account.preferences.imperial")}</option>
          </select>
        </div>
      </div>
      <SubmitButton className="justify-self-start" pendingText={t("account.preferences.saving")}>
        {t("account.preferences.save")}
      </SubmitButton>
    </form>
  );
}
