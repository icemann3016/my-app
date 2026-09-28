"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/forms";
import { setAircraftStatus } from "../../actions";

/** Clear the grounding by listing the aircraft again (the listing checks still apply). */
export function ClearGrounding({ id }: { id: string }) {
  const t = useTranslations("defects");
  const [state, formAction] = useActionState(setAircraftStatus, initialFormState);
  return (
    <form action={formAction} className="grid gap-2">
      <FormMessage state={state} />
      <input type="hidden" name="id" value={id} />
      <SubmitButton name="status" value="listed" variant="outline" className="justify-self-start">
        {t("clear")}
      </SubmitButton>
    </form>
  );
}
