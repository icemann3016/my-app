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
import { type FormState, initialFormState } from "@/lib/forms";
import {
  CLASS_RATINGS,
  LICENCE_LABELS,
  LICENCE_TYPES,
  MEDICAL_CLASSES,
  PRIVILEGES,
  RATING_KINDS,
} from "@/lib/pilot/catalog";
import type { CredentialKind } from "@/lib/pilot/labels";
import { saveLicence, saveMedical, saveRating } from "./actions";

export type Country = { code: string; name: string };

const actions = { licence: saveLicence, rating: saveRating, medical: saveMedical };
const section = { licence: "licences", rating: "ratings", medical: "medical" } as const;

/** Add or edit a licence, rating or medical in a dialog. */
export function CredentialDialog({
  kind,
  values,
  document,
  countries,
  wasVerified,
  label,
}: {
  kind: CredentialKind;
  /** Current values when editing (dates as YYYY-MM-DD). */
  values?: Record<string, string>;
  document?: UploadedDocument | null;
  countries: Country[];
  wasVerified?: boolean;
  /** Accessible name of the edit button, e.g. "Edit PPL(A)". */
  label?: string;
}) {
  const t = useTranslations(`pilot.${section[kind]}`);
  const tp = useTranslations("pilot");
  const [open, setOpen] = useState(false);
  const editing = Boolean(values?.id);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {editing ? (
          <Button variant="ghost" size="sm" aria-label={label}>
            <PencilIcon aria-hidden /> {tp("edit")}
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <PlusIcon aria-hidden /> {t("add")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? t("editTitle") : t("addTitle")}</DialogTitle>
          <DialogDescription>{t("dialogDescription")}</DialogDescription>
        </DialogHeader>
        <CredentialForm
          kind={kind}
          values={values}
          document={document}
          countries={countries}
          wasVerified={wasVerified}
          onSaved={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function CredentialForm({
  kind,
  values: initial,
  document,
  countries,
  wasVerified,
  onSaved,
}: {
  kind: CredentialKind;
  values?: Record<string, string>;
  document?: UploadedDocument | null;
  countries: Country[];
  wasVerified?: boolean;
  onSaved: () => void;
}) {
  const t = useTranslations("pilot");
  const [state, formAction] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await actions[kind](prev, formData);
    if (result.ok) onSaved();
    return result;
  }, initialFormState);
  const v = { ...initial, ...state.values };
  const e = state.errors ?? {};
  const countryOptions = countries.map((c) => ({ value: c.code, label: c.name }));

  return (
    <form action={formAction} className="grid gap-4">
      <FormMessage state={state} />
      {wasVerified && (
        <Alert>
          <TriangleAlertIcon />
          <AlertDescription>{t("editResetsReview")}</AlertDescription>
        </Alert>
      )}
      {v.id && <input type="hidden" name="id" value={v.id} />}

      {kind === "licence" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              name="type"
              label={t("licences.type")}
              defaultValue={v.type ?? "ppl_a"}
              errors={e.type}
              options={LICENCE_TYPES.map((code) => ({
                value: code,
                label: LICENCE_LABELS[code] ?? t("licences.other"),
              }))}
            />
            <SelectField
              name="issuingState"
              label={t("fields.issuingState")}
              defaultValue={v.issuingState ?? ""}
              errors={e.issuingState}
              required
              options={[{ value: "", label: t("fields.chooseCountry") }, ...countryOptions]}
            />
          </div>
          <TextField
            name="number"
            label={t("licences.number")}
            hint={t("licences.numberHint")}
            defaultValue={v.number}
            errors={e.number}
            maxLength={50}
            autoComplete="off"
            required
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              name="issuedOn"
              type="date"
              label={t("licences.issuedOn")}
              defaultValue={v.issuedOn}
              errors={e.issuedOn}
            />
            <TextField
              name="expiresOn"
              type="date"
              label={t("licences.expiresOn")}
              hint={t("licences.expiresOnHint")}
              defaultValue={v.expiresOn}
              errors={e.expiresOn}
            />
          </div>
          <DocumentField
            name="documentId"
            label={t("fields.document")}
            hint={t("licences.documentHint")}
            required
            initial={document}
            errors={e.documentId}
          />
        </>
      )}

      {kind === "rating" && <RatingFields values={v} errors={e} document={document} />}

      {kind === "medical" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              name="class"
              label={t("medical.class")}
              defaultValue={v.class ?? "class2"}
              errors={e.class}
              options={MEDICAL_CLASSES.map((c) => ({
                value: c,
                label: t(`medical.classes.${c}`),
              }))}
            />
            <SelectField
              name="issuingState"
              label={t("fields.issuingState")}
              defaultValue={v.issuingState ?? ""}
              errors={e.issuingState}
              required
              options={[{ value: "", label: t("fields.chooseCountry") }, ...countryOptions]}
            />
          </div>
          <TextField
            name="validUntil"
            type="date"
            label={t("medical.validUntil")}
            hint={t("medical.validUntilHint")}
            defaultValue={v.validUntil}
            errors={e.validUntil}
            required
          />
          <DocumentField
            name="documentId"
            label={t("fields.document")}
            hint={t("medical.documentHint")}
            required
            initial={document}
            errors={e.documentId}
          />
        </>
      )}

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

function RatingFields({
  values: v,
  errors: e,
  document,
}: {
  values: Record<string, string | undefined>;
  errors: Record<string, string[] | undefined>;
  document?: UploadedDocument | null;
}) {
  const t = useTranslations("pilot");
  const [kind, setKind] = useState(v.kind ?? "class");
  // Keep the chosen code only while it fits the chosen kind.
  const code = v.kind === kind ? v.code : undefined;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          name="kind"
          label={t("ratings.kind")}
          value={kind}
          onChange={(ev) => setKind(ev.target.value)}
          errors={e.kind}
          options={RATING_KINDS.map((k) => ({ value: k, label: t(`ratings.kinds.${k}`) }))}
        />
        {kind === "class" && (
          <SelectField
            key="class"
            name="code"
            label={t("ratings.code")}
            defaultValue={code ?? "SEP_LAND"}
            errors={e.code}
            options={CLASS_RATINGS.map((c) => ({ value: c, label: t(`classRatings.${c}`) }))}
          />
        )}
        {kind === "privilege" && (
          <SelectField
            key="privilege"
            name="code"
            label={t("ratings.code")}
            defaultValue={code ?? "NIGHT"}
            errors={e.code}
            options={PRIVILEGES.map((p) => ({ value: p, label: t(`privileges.${p}`) }))}
          />
        )}
        {kind === "type" && (
          <TextField
            key="type"
            name="code"
            label={t("ratings.typeCode")}
            hint={t("ratings.typeCodeHint")}
            defaultValue={code}
            errors={e.code}
            maxLength={8}
            autoCapitalize="characters"
            autoComplete="off"
            required
          />
        )}
      </div>
      <TextField
        name="expiresOn"
        type="date"
        label={t("ratings.expiresOn")}
        hint={t("ratings.expiresOnHint")}
        defaultValue={v.expiresOn}
        errors={e.expiresOn}
      />
      <DocumentField
        name="documentId"
        label={t("fields.documentOptional")}
        hint={t("ratings.documentHint")}
        initial={document}
        errors={e.documentId}
      />
    </>
  );
}
