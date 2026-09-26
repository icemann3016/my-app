"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextField } from "@/components/forms/text-field";
import { initialFormState } from "@/lib/forms";
import { requestPasswordReset } from "../actions";

export function ForgotPasswordForm() {
  const t = useTranslations();
  const [state, formAction] = useActionState(requestPasswordReset, initialFormState);
  return (
    <form action={formAction} className="grid gap-4">
      <FormMessage state={state} />
      <TextField
        name="email"
        label={t("fields.email")}
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        errors={state.errors?.email}
      />
      <SubmitButton pendingText={t("forgotPassword.pending")}>
        {t("forgotPassword.submit")}
      </SubmitButton>
    </form>
  );
}
