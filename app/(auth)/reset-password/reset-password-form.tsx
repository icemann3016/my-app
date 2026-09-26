"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextField } from "@/components/forms/text-field";
import { initialFormState } from "@/lib/forms";
import { resetPassword } from "../actions";

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("resetPassword");
  const [state, formAction] = useActionState(resetPassword, initialFormState);
  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />
      <TextField
        name="password"
        label={t("newPassword")}
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        maxLength={72}
        errors={state.errors?.password}
      />
      <TextField
        name="confirm"
        label={t("repeatPassword")}
        type="password"
        autoComplete="new-password"
        required
        errors={state.errors?.confirm}
      />
      <SubmitButton pendingText={t("pending")}>{t("submit")}</SubmitButton>
    </form>
  );
}
