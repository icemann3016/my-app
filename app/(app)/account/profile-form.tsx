"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextAreaField, TextField } from "@/components/forms/text-field";
import { initialFormState } from "@/lib/forms";
import { updateProfile } from "./actions";

export function ProfileForm(props: { displayName: string; homeAirport: string; bio: string }) {
  const [state, formAction] = useActionState(updateProfile, initialFormState);
  const v = state.values ?? props;

  return (
    <form action={formAction} className="grid gap-4">
      <FormMessage state={state} />
      <TextField
        name="displayName"
        label="Name"
        required
        maxLength={80}
        autoComplete="name"
        defaultValue={v.displayName}
        errors={state.errors?.displayName}
      />
      <TextField
        name="homeAirport"
        label="Home airfield (ICAO)"
        placeholder="LBSF"
        maxLength={4}
        autoCapitalize="characters"
        className="w-32 uppercase"
        defaultValue={v.homeAirport}
        errors={state.errors?.homeAirport}
        hint="The 4-letter code of the airfield you usually fly from. An airport search is coming soon."
      />
      <TextAreaField
        name="bio"
        label="About you"
        maxLength={1000}
        rows={4}
        placeholder="e.g. PPL(A) since 2019, around 250 hours, mostly on C172 and PA-28."
        defaultValue={v.bio}
        errors={state.errors?.bio}
      />
      <SubmitButton className="justify-self-start" pendingText="Saving…">
        Save profile
      </SubmitButton>
    </form>
  );
}
