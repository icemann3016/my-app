"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextField } from "@/components/forms/text-field";
import { initialFormState } from "@/lib/forms";
import { saveContact } from "./contact-actions";

/** Phone number for the other side of accepted bookings (MSG-2). */
export function ContactForm({ phone }: { phone: string | null }) {
  const t = useTranslations("account.contact");
  const [state, formAction] = useActionState(saveContact, initialFormState);
  return (
    <form action={formAction} className="grid gap-4">
      <FormMessage state={state} />
      <TextField
        name="phone"
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        label={t("phone")}
        hint={t("phoneHint")}
        placeholder="+359 88 123 4567"
        defaultValue={state.values?.phone ?? phone ?? ""}
        errors={state.errors?.phone}
        className="max-w-xs"
      />
      <SubmitButton className="justify-self-start" pendingText={t("saving")}>
        {t("save")}
      </SubmitButton>
    </form>
  );
}
