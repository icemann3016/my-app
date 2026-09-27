"use client";

import { useActionState, useState } from "react";
import { PencilIcon, PlusIcon, TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { DocumentField, type UploadedDocument } from "@/components/document-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { SelectField, TextField } from "@/components/forms/text-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { REFERENCE_DOCUMENT_KINDS, VERIFIED_DOCUMENT_KINDS } from "@/lib/aircraft/catalog";
import { type FormState, initialFormState } from "@/lib/forms";
import { saveAircraftDocument } from "./actions";

/** Add or edit an aircraft document: verified (CofA, ARC, insurance) or for renters (POH…). */
export function DocumentDialog({
  aircraftId,
  group,
  values,
  document,
  wasVerified,
  label,
}: {
  aircraftId: string;
  group: "verified" | "reference";
  values?: Record<string, string>;
  document?: UploadedDocument | null;
  wasVerified?: boolean;
  label?: string;
}) {
  const t = useTranslations("aircraft.documents");
  const [open, setOpen] = useState(false);
  const editing = Boolean(values?.id);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {editing ? (
          <Button variant="ghost" size="sm" aria-label={label}>
            <PencilIcon aria-hidden /> {t("edit")}
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <PlusIcon aria-hidden /> {t(`add.${group}`)}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? t("editTitle") : t(`add.${group}`)}</DialogTitle>
          <DialogDescription>{t(`dialogText.${group}`)}</DialogDescription>
        </DialogHeader>
        <DocumentForm
          aircraftId={aircraftId}
          group={group}
          values={values}
          document={document}
          wasVerified={wasVerified}
          onSaved={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function DocumentForm({
  aircraftId,
  group,
  values: initial,
  document,
  wasVerified,
  onSaved,
}: {
  aircraftId: string;
  group: "verified" | "reference";
  values?: Record<string, string>;
  document?: UploadedDocument | null;
  wasVerified?: boolean;
  onSaved: () => void;
}) {
  const t = useTranslations("aircraft.documents");
  const [state, formAction] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await saveAircraftDocument(prev, formData);
    if (result.ok) onSaved();
    return result;
  }, initialFormState);
  const v = { ...initial, ...state.values };
  const e = state.errors ?? {};
  const kinds = group === "verified" ? VERIFIED_DOCUMENT_KINDS : REFERENCE_DOCUMENT_KINDS;
  const [kind, setKind] = useState<string>(v.kind ?? kinds[group === "verified" ? 1 : 0]);
  const editing = Boolean(v.id);

  return (
    <form action={formAction} className="grid gap-4">
      <FormMessage state={state} />
      {wasVerified && (
        <Alert>
          <TriangleAlertIcon />
          <AlertDescription>{t("editResetsReview")}</AlertDescription>
        </Alert>
      )}
      <input type="hidden" name="aircraftId" value={aircraftId} />
      {v.id && <input type="hidden" name="id" value={v.id} />}
      {editing ? (
        <input type="hidden" name="kind" value={kind} />
      ) : (
        <SelectField
          name="kind"
          label={t("kind")}
          value={kind}
          onChange={(ev) => setKind(ev.target.value)}
          errors={e.kind}
          options={kinds.map((k) => ({ value: k, label: t(`kinds.${k}`) }))}
        />
      )}
      {group === "reference" ? (
        <TextField
          name="title"
          label={t("title")}
          hint={t("titleHint")}
          defaultValue={v.title}
          errors={e.title}
          maxLength={100}
        />
      ) : (
        <TextField
          name="expiresOn"
          type="date"
          label={kind === "cofa" ? t("expiresOnOptional") : t("expiresOn")}
          defaultValue={v.expiresOn}
          errors={e.expiresOn}
          required={kind !== "cofa"}
        />
      )}
      <DocumentField
        name="documentId"
        label={t("file")}
        required
        initial={document}
        errors={e.documentId}
      />
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            {t("cancel")}
          </Button>
        </DialogClose>
        <SubmitButton pendingText={t("saving")}>{t("save")}</SubmitButton>
      </DialogFooter>
    </form>
  );
}
