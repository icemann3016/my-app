"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextAreaField } from "@/components/forms/text-field";
import { initialFormState } from "@/lib/forms";
import { confirmLog, requestCorrection, submitLog } from "./actions";

function Hidden({ bookingId, logId }: { bookingId: string; logId: string }) {
  return (
    <>
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="logId" value={logId} />
    </>
  );
}

/** Check-in: the pilot sends the log to the owner. */
export function SubmitLog(props: { bookingId: string; logId: string; disabled: boolean }) {
  const t = useTranslations("flightLog");
  const [state, formAction] = useActionState(submitLog, initialFormState);
  return (
    <form action={formAction} className="grid gap-2">
      <FormMessage state={state} />
      <Hidden {...props} />
      <p className="text-muted-foreground">{t("submitHint")}</p>
      <SubmitButton
        className="justify-self-start"
        disabled={props.disabled}
        pendingText={t("saving")}
      >
        {t("submit")}
      </SubmitButton>
    </form>
  );
}

/** The owner confirms the submitted log or asks for a correction. */
export function OwnerActions(props: { bookingId: string; logId: string; canConfirm: boolean }) {
  const t = useTranslations("flightLog");
  const [confirmState, confirmAction] = useActionState(confirmLog, initialFormState);
  const [fixState, fixAction] = useActionState(requestCorrection, initialFormState);
  return (
    <div className="grid gap-6">
      <form action={confirmAction} className="grid gap-2">
        <FormMessage state={confirmState} />
        <Hidden bookingId={props.bookingId} logId={props.logId} />
        <p className="text-muted-foreground">{t("confirmHint")}</p>
        <SubmitButton
          className="justify-self-start"
          disabled={!props.canConfirm}
          pendingText={t("saving")}
        >
          {t("confirm")}
        </SubmitButton>
      </form>
      <form action={fixAction} className="grid gap-2">
        <FormMessage state={fixState} />
        <Hidden bookingId={props.bookingId} logId={props.logId} />
        <TextAreaField
          name="note"
          label={t("correctionLabel")}
          maxLength={500}
          defaultValue={fixState.values?.note}
          errors={fixState.errors?.note}
        />
        <SubmitButton variant="outline" className="justify-self-start" pendingText={t("saving")}>
          {t("requestCorrection")}
        </SubmitButton>
      </form>
    </div>
  );
}
