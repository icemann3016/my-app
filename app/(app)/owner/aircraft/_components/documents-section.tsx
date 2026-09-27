"use client";

import { useActionState } from "react";
import { FileTextIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";

import { DocumentField } from "@/components/document-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { SelectField, TextField } from "@/components/forms/text-field";
import { ExpiryText, StatusBadge } from "@/components/pilot/status-badge";
import { FILE_KINDS, type DocumentKind } from "@/lib/aircraft/catalog";
import type { VerificationStatus } from "@/lib/db/schema";
import { type FormState, initialFormState } from "@/lib/forms";
import type { ExpiryState } from "@/lib/pilot/validity";
import { deleteAircraftDocument, deleteAircraftFile } from "../actions";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export type DocumentRow = {
  id: string;
  kind: DocumentKind;
  status: VerificationStatus;
  expiresOn: string | null;
  expiry: { state: ExpiryState; text: string };
  rejectionReason: string | null;
  document: { id: string; filename: string } | null;
};

/** CofA, ARC or insurance: current status and a form to upload or replace it. */
export function AircraftDocumentCard({
  aircraftId,
  kind,
  row,
  action,
}: {
  aircraftId: string;
  kind: DocumentKind;
  row: DocumentRow | null;
  action: Action;
}) {
  const t = useTranslations("owner.documents");
  const tp = useTranslations("pilot");
  const [state, formAction] = useActionState(action, initialFormState);
  const v = { expiresOn: row?.expiresOn ?? "", ...state.values };
  const name = t(`kinds.${kind}`);

  return (
    <section
      aria-labelledby={`doc-${kind}`}
      className="grid gap-3 rounded-lg border p-4 first:mt-0"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={`doc-${kind}`} className="font-medium">
          {name}
        </h3>
        {row ? (
          <StatusBadge status={row.status} label={tp(`status.${row.status}`)} />
        ) : (
          <span className="text-xs text-muted-foreground">{t("missing")}</span>
        )}
        {row?.expiresOn && (
          <span className="text-sm">
            <ExpiryText state={row.expiry.state} text={row.expiry.text} />
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{t(`hints.${kind}`)}</p>
      {row?.status === "rejected" && row.rejectionReason && (
        <p className="text-sm text-destructive">
          {tp("rejectedBecause", { reason: row.rejectionReason })}
        </p>
      )}
      <form action={formAction} className="grid gap-3">
        <FormMessage state={state} />
        {row && <input type="hidden" name="id" value={row.id} />}
        <input type="hidden" name="kind" value={kind} />
        <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
          <DocumentField
            name="documentId"
            label={t("file")}
            required
            initial={row?.document ?? null}
            errors={state.errors?.documentId}
          />
          {kind !== "cofa" && (
            <TextField
              id={`expires-${kind}`}
              name="expiresOn"
              type="date"
              label={t("expiresOn")}
              defaultValue={v.expiresOn}
              errors={state.errors?.expiresOn}
              required
            />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <SubmitButton size="sm" pendingText={t("saving")} aria-label={t("saveLabel", { name })}>
            {row ? t("update") : t("submit")}
          </SubmitButton>
        </div>
      </form>
      {row && (
        <form action={deleteAircraftDocument}>
          <input type="hidden" name="aircraftId" value={aircraftId} />
          <input type="hidden" name="id" value={row.id} />
          <SubmitButton
            variant="ghost"
            size="sm"
            className="-ml-3 text-destructive"
            aria-label={t("deleteLabel", { name })}
          >
            <Trash2Icon aria-hidden /> {t("delete")}
          </SubmitButton>
        </form>
      )}
    </section>
  );
}

export type FileRow = {
  id: string;
  kind: (typeof FILE_KINDS)[number];
  title: string | null;
  document: { id: string; filename: string };
};

/** POH extract, checklists, weight & balance: for renters to read before the flight. */
export function ReferenceFiles({
  aircraftId,
  files,
  action,
}: {
  aircraftId: string;
  files: FileRow[];
  action: Action;
}) {
  const t = useTranslations("owner.files");
  const [state, formAction] = useActionState(action, initialFormState);

  return (
    <div className="grid gap-4">
      {files.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="grid divide-y rounded-lg border">
          {files.map((f) => {
            const name = f.title || t(`kinds.${f.kind}`);
            return (
              <li key={f.id} className="flex items-center gap-3 px-3 py-2">
                <FileTextIcon className="size-4 shrink-0 text-primary" aria-hidden />
                <div className="grid min-w-0">
                  <a
                    href={`/api/documents/${f.document.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-sm font-medium underline-offset-4 hover:underline"
                  >
                    {name}
                  </a>
                  <span className="truncate text-xs text-muted-foreground">
                    {t(`kinds.${f.kind}`)} · {f.document.filename}
                  </span>
                </div>
                <form action={deleteAircraftFile} className="ml-auto">
                  <input type="hidden" name="aircraftId" value={aircraftId} />
                  <input type="hidden" name="id" value={f.id} />
                  <SubmitButton
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive"
                    aria-label={t("deleteLabel", { name })}
                  >
                    <Trash2Icon aria-hidden />
                  </SubmitButton>
                </form>
              </li>
            );
          })}
        </ul>
      )}
      <form
        key={files.length}
        action={formAction}
        className="grid gap-3 rounded-lg border border-dashed p-4"
      >
        <h3 className="text-sm font-medium">{t("addTitle")}</h3>
        <FormMessage state={state} />
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField
            id="file-kind"
            name="kind"
            label={t("kind")}
            defaultValue={state.values?.kind ?? "poh"}
            options={FILE_KINDS.map((k) => ({ value: k, label: t(`kinds.${k}`) }))}
          />
          <TextField
            id="file-title"
            name="title"
            label={t("fileTitle")}
            placeholder={t("titlePlaceholder")}
            defaultValue={state.values?.title}
            errors={state.errors?.title}
            maxLength={100}
          />
        </div>
        <DocumentField
          name="documentId"
          label={t("file")}
          required
          errors={state.errors?.documentId}
        />
        <SubmitButton size="sm" variant="outline" className="justify-self-start">
          {t("add")}
        </SubmitButton>
      </form>
    </div>
  );
}
