"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { sendTestError } from "@/app/(app)/admin/monitoring-actions";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/lib/forms";

/** Sends a test error so admins can check that error monitoring is set up. */
export function TestErrorButton() {
  const t = useTranslations("admin.monitoring");
  const [state, formAction] = useActionState(sendTestError, initialFormState);
  return (
    <form action={formAction} className="grid gap-3">
      <FormMessage state={state} />
      <SubmitButton variant="outline" className="justify-self-start" pendingText={t("sending")}>
        {t("send")}
      </SubmitButton>
    </form>
  );
}
