"use client";

import { useActionState, useState } from "react";
import { TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { reportDefectAction } from "@/app/(app)/bookings/[id]/defect-actions";
import { DocumentField } from "@/components/document-field";
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
import { type FormState, initialFormState } from "@/lib/forms";
import { DEFECT_SEVERITIES } from "@/lib/validation/defect";

/** Report a defect on an aircraft; the owner is emailed straight away (BKG-8). */
export function ReportDefectDialog({
  aircraftId,
  bookingId,
}: {
  aircraftId: string;
  /** The booking it was found on; none when the owner reports it. */
  bookingId: string | null;
}) {
  const t = useTranslations("defects");
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await reportDefectAction(prev, formData);
    if (result.ok) setOpen(false);
    return result;
  }, initialFormState);
  const v = state.ok ? {} : (state.values ?? {});
  const e = state.errors ?? {};
  return (
    <>
      {state.ok && <FormMessage state={state} />}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="justify-self-start text-destructive">
            <TriangleAlertIcon aria-hidden /> {t("report")}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("reportTitle")}</DialogTitle>
            <DialogDescription>{t("reportHint")}</DialogDescription>
          </DialogHeader>
          <form action={formAction} className="grid gap-4">
            {!state.ok && <FormMessage state={state} />}
            <input type="hidden" name="aircraftId" value={aircraftId} />
            {bookingId && <input type="hidden" name="bookingId" value={bookingId} />}
            <SelectField
              id="defect-severity"
              name="severity"
              label={t("severity")}
              defaultValue={v.severity ?? "minor"}
              options={DEFECT_SEVERITIES.map((s) => ({ value: s, label: t(`severities.${s}`) }))}
            />
            <TextAreaField
              id="defect-description"
              name="description"
              label={t("description")}
              hint={t("descriptionHint")}
              maxLength={2000}
              rows={4}
              defaultValue={v.description}
              errors={e.description}
              required
            />
            <DocumentField name="photoId" label={t("photo")} errors={e.photoId} />
            <SubmitButton
              variant="destructive"
              className="justify-self-start"
              pendingText={t("sending")}
            >
              {t("send")}
            </SubmitButton>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
