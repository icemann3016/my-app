"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextField } from "@/components/forms/text-field";
import { initialFormState } from "@/lib/forms";
import { resendConfirmation } from "../../actions";

export function ResendForm() {
  const [state, formAction] = useActionState(resendConfirmation, initialFormState);
  return (
    <form action={formAction} className="grid gap-3">
      <FormMessage state={state} />
      <TextField
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        errors={state.errors?.email}
      />
      <SubmitButton variant="outline" pendingText="Sending…">
        Resend confirmation email
      </SubmitButton>
    </form>
  );
}
