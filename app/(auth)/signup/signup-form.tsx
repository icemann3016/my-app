"use client";

import { useActionState } from "react";
import Link from "next/link";

import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextField } from "@/components/forms/text-field";
import { initialFormState } from "@/lib/forms";
import { signUp } from "../actions";

export function SignupForm() {
  const [state, formAction] = useActionState(signUp, initialFormState);

  return (
    <form action={formAction} className="grid gap-4">
      <FormMessage state={state} />
      <TextField
        name="displayName"
        label="Your name"
        autoComplete="name"
        required
        maxLength={80}
        defaultValue={state.values?.displayName}
        errors={state.errors?.displayName}
        hint="Shown on your public profile."
      />
      <TextField
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        errors={state.errors?.email}
      />
      <TextField
        name="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        maxLength={72}
        errors={state.errors?.password}
        hint="At least 8 characters."
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
            I accept the{" "}
            <Link href="/terms" className="underline underline-offset-4" target="_blank">
              terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline underline-offset-4" target="_blank">
              privacy policy
            </Link>
            .
          </span>
        </label>
        {state.errors?.terms && <p className="text-sm text-destructive">{state.errors.terms[0]}</p>}
      </div>
      <SubmitButton pendingText="Creating account…">Create account</SubmitButton>
    </form>
  );
}
