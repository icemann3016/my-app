"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";

import { moderate } from "@/app/(app)/admin/moderation-actions";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextAreaField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ModerationOp } from "@/lib/admin/ops";
import { type FormState, initialFormState } from "@/lib/forms";

/** A moderation action behind a confirmation with an optional reason for the audit log. */
export function ModerationButton({
  op,
  targetId,
  reportId,
  label,
  destructive = false,
}: {
  op: ModerationOp;
  targetId: string;
  /** Close this report as resolved when the action succeeds. */
  reportId?: string;
  label: string;
  destructive?: boolean;
}) {
  const t = useTranslations("admin.moderation");
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await moderate(prev, formData);
    if (result.ok) setOpen(false);
    return result;
  }, initialFormState);
  const id = `${op}-${targetId.slice(0, 8)}`;
  return (
    <>
      {state.ok && <p className="text-xs text-success">{state.message}</p>}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant={destructive ? "destructive" : "outline"} className="h-8">
            {label}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
            <DialogDescription>{t(`confirm.${op}`)}</DialogDescription>
          </DialogHeader>
          <form action={formAction} className="grid gap-4">
            {!state.ok && <FormMessage state={state} />}
            <input type="hidden" name="op" value={op} />
            <input type="hidden" name="targetId" value={targetId} />
            {reportId && <input type="hidden" name="reportId" value={reportId} />}
            <TextAreaField
              id={`${id}-reason`}
              name="reason"
              label={t("reason")}
              hint={t("reasonHint")}
              maxLength={500}
              rows={3}
            />
            <SubmitButton
              variant={destructive ? "destructive" : "default"}
              className="justify-self-start"
              pendingText={t("working")}
            >
              {label}
            </SubmitButton>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
