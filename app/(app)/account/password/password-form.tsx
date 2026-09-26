"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextField } from "@/components/forms/text-field";
import { initialFormState } from "@/lib/forms";
import { changePassword } from "../actions";

export function PasswordForm() {
  const t = useTranslations("password");
  const [state, formAction] = useActionState(changePassword, initialFormState);
  return (
    <form action={formAction} className="grid gap-4">
      <FormMessage state={state} />
      <TextField
        name="currentPassword"
        label={t("current")}
        type="password"
        autoComplete="current-password"
        required
        errors={state.errors?.currentPassword}
      />
      <TextField
        name="password"
        label={t("new")}
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        maxLength={72}
        errors={state.errors?.password}
      />
      <TextField
        name="confirm"
        label={t("repeat")}
        type="password"
        autoComplete="new-password"
        required
        errors={state.errors?.confirm}
      />
      <SubmitButton pendingText={t("saving")}>{t("submit")}</SubmitButton>
    </form>
  );
}
