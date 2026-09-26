"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextField } from "@/components/forms/text-field";
import { initialFormState } from "@/lib/forms";
import { updatePassword } from "../actions";

export function PasswordForm() {
  const [state, formAction] = useActionState(updatePassword, initialFormState);
  return (
    <form action={formAction} className="grid gap-4">
      <FormMessage state={state} />
      <TextField
        name="password"
        label="New password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        maxLength={72}
        errors={state.errors?.password}
      />
      <TextField
        name="confirm"
        label="Repeat new password"
        type="password"
        autoComplete="new-password"
        required
        errors={state.errors?.confirm}
      />
      <SubmitButton pendingText="Saving…">Change password</SubmitButton>
    </form>
  );
}
