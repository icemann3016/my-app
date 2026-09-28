"use client";

import { useActionState, useState } from "react";
import { FlagIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { reportAction } from "@/app/(app)/reports/actions";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { SelectField, TextAreaField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ReportTarget } from "@/lib/db/schema";
import { type FormState, initialFormState } from "@/lib/forms";
import { REPORT_REASONS } from "@/lib/validation/report";

/** "Report" link that sends a review, user, listing or message to the admins (RAT-5, ADM-3). */
export function ReportDialog({
  targetType,
  targetId,
  className,
}: {
  targetType: ReportTarget;
  targetId: string;
  className?: string;
}) {
  const t = useTranslations("reports");
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<FormState | null>(null);
  const [state, formAction] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await reportAction(prev, formData);
    if (result.ok) {
      setDone(result);
      setOpen(false);
    }
    return result;
  }, initialFormState);
  const v = state.ok ? {} : (state.values ?? {});
  const e = state.errors ?? {};
  const prefix = `report-${targetType}-${targetId.slice(0, 8)}`;
  if (done) return <p className="text-xs text-muted-foreground">{done.message}</p>;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={className ?? "h-7 justify-self-start px-2 text-xs text-muted-foreground"}
        >
          <FlagIcon aria-hidden /> {t("report")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t(`title.${targetType}`)}</DialogTitle>
          <DialogDescription>{t("hint")}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          {!state.ok && <FormMessage state={state} />}
          <input type="hidden" name="targetType" value={targetType} />
          <input type="hidden" name="targetId" value={targetId} />
          <SelectField
            id={`${prefix}-reason`}
            name="reason"
            label={t("reason")}
            defaultValue={v.reason ?? ""}
            errors={e.reason}
            options={[
              { value: "", label: t("choose") },
              ...REPORT_REASONS.map((r) => ({ value: r, label: t(`reasons.${r}`) })),
            ]}
          />
          <TextAreaField
            id={`${prefix}-details`}
            name="details"
            label={t("details")}
            maxLength={1000}
            rows={3}
            defaultValue={v.details}
            errors={e.details}
          />
          <SubmitButton className="justify-self-start" pendingText={t("sending")}>
            {t("send")}
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
