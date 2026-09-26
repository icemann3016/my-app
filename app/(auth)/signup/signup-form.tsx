"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { richLink } from "@/components/rich-link";
import { TextField } from "@/components/forms/text-field";
import { initialFormState } from "@/lib/forms";
import { signUp } from "../actions";

export function SignupForm() {
  const t = useTranslations();
  const [state, formAction] = useActionState(signUp, initialFormState);

  return (
    <form action={formAction} className="grid gap-4">
      <FormMessage state={state} />
      <TextField
        name="displayName"
        label={t("signup.name")}
        autoComplete="name"
        required
        maxLength={80}
        defaultValue={state.values?.displayName}
        errors={state.errors?.displayName}
        hint={t("signup.nameHint")}
      />
      <TextField
        name="email"
        label={t("fields.email")}
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        errors={state.errors?.email}
      />
      <TextField
        name="password"
        label={t("fields.password")}
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        maxLength={72}
        errors={state.errors?.password}
        hint={t("signup.passwordHint")}
      />
      <div className="grid gap-1">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="terms"
            required
            defaultChecked={state.values?.terms === "on"}
            className="mt-0.5 size-4 accent-primary"
            aria-invalid={state.errors?.terms ? true : undefined}
          />
          <span>
            {t.rich("signup.acceptTerms", {
              terms: richLink("/terms"),
              privacy: richLink("/privacy"),
            })}
          </span>
        </label>
        {state.errors?.terms && <p className="text-sm text-destructive">{state.errors.terms[0]}</p>}
      </div>
      <SubmitButton pendingText={t("signup.pending")}>{t("signup.submit")}</SubmitButton>
    </form>
  );
}
