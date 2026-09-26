"use client";

import { useActionState } from "react";
import Link from "next/link";

import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextField } from "@/components/forms/text-field";
import { initialFormState } from "@/lib/forms";
import { signIn } from "../actions";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState(signIn, initialFormState);

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="next" value={next} />
      <FormMessage state={state} />
      {state.code === "email_not_confirmed" && (
        <p className="-mt-2 text-sm">
          <Link href="/signup/check-email" className="underline underline-offset-4">
            Send the confirmation email again
          </Link>
        </p>
      )}
      <TextField
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        errors={state.errors?.email}
      />
      <div className="grid gap-2">
        <TextField
          name="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          errors={state.errors?.password}
        />
        <Link
          href="/forgot-password"
          className="justify-self-end text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Forgot password?
        </Link>
      </div>
      <SubmitButton pendingText="Logging in…">Log in</SubmitButton>
    </form>
  );
}
