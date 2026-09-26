"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextAreaField, TextField } from "@/components/forms/text-field";
import { initialFormState } from "@/lib/forms";
import { updateProfile } from "./actions";

export function ProfileForm(props: { displayName: string; homeAirport: string; bio: string }) {
  const t = useTranslations("account.profile");
  const [state, formAction] = useActionState(updateProfile, initialFormState);
  const v = state.values ?? props;

  return (
    <form action={formAction} className="grid gap-4">
      <FormMessage state={state} />
      <TextField
        name="displayName"
        label={t("name")}
        required
        maxLength={80}
        autoComplete="name"
        defaultValue={v.displayName}
        errors={state.errors?.displayName}
      />
      <TextField
        name="homeAirport"
        label={t("homeAirfield")}
        placeholder="LBSF"
        maxLength={4}
        autoCapitalize="characters"
        className="w-32 uppercase"
        defaultValue={v.homeAirport}
        errors={state.errors?.homeAirport}
        hint={t("homeAirfieldHint")}
      />
      <TextAreaField
        name="bio"
        label={t("bio")}
        maxLength={1000}
        rows={4}
        placeholder={t("bioPlaceholder")}
        defaultValue={v.bio}
        errors={state.errors?.bio}
      />
      <SubmitButton className="justify-self-start" pendingText={t("saving")}>
        {t("save")}
      </SubmitButton>
    </form>
  );
}
