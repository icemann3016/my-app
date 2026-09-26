"use client";

import { useId, useRef, useState } from "react";
import { ExternalLinkIcon, FileTextIcon, Loader2Icon, UploadIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DOCUMENT_MAX_BYTES, DOCUMENT_TYPES } from "@/lib/validation/pilot";

export type UploadedDocument = { id: string; filename: string };

/** Photos from phones are often larger than needed: shrink big images before uploading. */
const COMPRESS_ABOVE_BYTES = 1.5 * 1024 * 1024;
const MAX_IMAGE_SIDE = 2400;

async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= COMPRESS_ABOVE_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]*$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

/**
 * Upload a private document (licence scan, medical…). The file is uploaded as soon as it is
 * chosen; the form then submits only its id in a hidden input.
 */
export function DocumentField({
  name,
  label,
  hint,
  required,
  errors,
  initial,
}: {
  name: string;
  label: string;
  hint?: string;
  required?: boolean;
  errors?: string[];
  initial?: UploadedDocument | null;
}) {
  const t = useTranslations("documents");
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [doc, setDoc] = useState<UploadedDocument | null>(initial ?? null);
  const [status, setStatus] = useState<"idle" | "preparing" | "uploading">("idle");
  const [error, setError] = useState<string | null>(null);
  // A server error (e.g. "please upload a scan") no longer applies once a file is uploaded.
  const [answeredErrors, setAnsweredErrors] = useState<string[] | undefined>();
  const message = error ?? (errors === answeredErrors ? undefined : errors?.[0]);

  async function onFileChosen(chosen: File | undefined) {
    setError(null);
    if (!chosen) return;
    if (!(DOCUMENT_TYPES as readonly string[]).includes(chosen.type)) {
      setError(t("invalidType"));
      return;
    }
    setStatus("preparing");
    const file = await shrinkImage(chosen);
    if (file.size > DOCUMENT_MAX_BYTES) {
      setStatus("idle");
      setError(t("tooLarge"));
      return;
    }
    setStatus("uploading");
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/documents", { method: "POST", body }).catch(() => null);
    const json = (await res?.json().catch(() => null)) as
      (UploadedDocument & { error?: undefined }) | { error: string } | null;
    setStatus("idle");
    if (!res?.ok || !json || json.error !== undefined) {
      setError(json?.error ?? t("failed"));
      return;
    }
    setDoc({ id: json.id, filename: json.filename });
    setAnsweredErrors(errors);
  }

  const busy = status !== "idle";
  return (
    <div className="grid gap-2">
      <Label htmlFor={`${id}-file`}>
        {label}
        {required && <span className="sr-only"> *</span>}
      </Label>
      <input type="hidden" name={name} value={doc?.id ?? ""} />
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed p-3">
        {doc ? (
          <a
            href={`/api/documents/${doc.id}`}
            target="_blank"
            rel="noreferrer"
            className="flex min-w-0 items-center gap-2 text-sm underline-offset-4 hover:underline"
          >
            <FileTextIcon className="size-4 shrink-0 text-primary" aria-hidden />
            <span className="truncate">{doc.filename}</span>
            <ExternalLinkIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="sr-only">({t("view")})</span>
          </a>
        ) : (
          <span className="text-sm text-muted-foreground">{t("none")}</span>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ml-auto"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          aria-describedby={message ? `${id}-error` : `${id}-hint`}
        >
          {busy ? <Loader2Icon className="animate-spin" aria-hidden /> : <UploadIcon aria-hidden />}
          {status === "preparing"
            ? t("preparing")
            : status === "uploading"
              ? t("uploading")
              : doc
                ? t("replace")
                : t("choose")}
        </Button>
      </div>
      <input
        ref={inputRef}
        id={`${id}-file`}
        type="file"
        accept={DOCUMENT_TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          void onFileChosen(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {message ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {message}
        </p>
      ) : (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint ? `${hint} ` : ""}
          {t("hint")}
        </p>
      )}
    </div>
  );
}
