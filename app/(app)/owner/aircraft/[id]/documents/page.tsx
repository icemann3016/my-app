import type { Metadata } from "next";
import { FileTextIcon, InfoIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { ContinueLink } from "@/components/aircraft/continue-link";
import { SectionHeading } from "@/components/aircraft/section-heading";
import { ExpiryText, StatusBadge } from "@/components/pilot/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type AircraftDocumentRow, getAircraftDocuments } from "@/lib/aircraft/documents";
import { requireOwnAircraft } from "@/lib/aircraft/owner";
import { intlLocale, type Locale } from "@/lib/i18n/config";
import { expiryState } from "@/lib/pilot/validity";
import { DeleteDocument } from "./delete-document";
import { DocumentDialog } from "./document-dialog";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("aircraft.sections");
  return { title: t("documents") };
}

export default async function DocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, aircraft } = await requireOwnAircraft(id, "documents");
  const t = await getTranslations("aircraft");
  const locale = (await getLocale()) as Locale;
  const docs = await getAircraftDocuments(user.id, id);
  const dateFormat = new Intl.DateTimeFormat(intlLocale(locale), {
    dateStyle: "medium",
    timeZone: "UTC",
  });
  const day = (d: string) => dateFormat.format(new Date(`${d}T00:00:00Z`));

  const groups = [
    { key: "verified" as const, rows: docs.filter((d) => d.status !== null) },
    { key: "reference" as const, rows: docs.filter((d) => d.status === null) },
  ];

  const name = (d: AircraftDocumentRow) => d.title ?? t(`documents.kinds.${d.kind}`);

  return (
    <div className="grid gap-6">
      <SectionHeading title={t("sections.documents")} text={t("sectionText.documents")} />
      {groups.map(({ key, rows }) => (
        <Card key={key}>
          <CardHeader className="flex flex-wrap items-start justify-between gap-3">
            <div className="grid gap-1.5">
              <CardTitle as="h2">{t(`documents.groups.${key}.title`)}</CardTitle>
              <CardDescription>{t(`documents.groups.${key}.text`)}</CardDescription>
            </div>
            <DocumentDialog aircraftId={id} group={key} />
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t(`documents.groups.${key}.empty`)}</p>
            ) : (
              <ul className="grid divide-y">
                {rows.map((d) => {
                  const state = expiryState(d.expiresOn);
                  return (
                    <li key={d.id} className="grid gap-2 py-3 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium">{name(d)}</h3>
                        {d.status && (
                          <StatusBadge
                            status={d.status}
                            label={t(`documents.status.${d.status}`)}
                          />
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        {d.title && <span>{t(`documents.kinds.${d.kind}`)}</span>}
                        {d.expiresOn && (
                          <ExpiryText
                            state={state}
                            text={t(`documents.expiry.${state === "none" ? "valid" : state}`, {
                              date: day(d.expiresOn),
                            })}
                          />
                        )}
                        <a
                          href={`/api/documents/${d.documentId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-foreground underline-offset-4 hover:underline"
                        >
                          <FileTextIcon className="size-3.5" aria-hidden />
                          {d.filename}
                        </a>
                      </div>
                      {d.status === "rejected" && d.rejectionReason && (
                        <p className="text-sm text-destructive">
                          {t("documents.rejectedBecause", { reason: d.rejectionReason })}
                        </p>
                      )}
                      <div className="-ml-3 flex gap-1">
                        <DocumentDialog
                          aircraftId={id}
                          group={key}
                          values={{
                            id: d.id,
                            kind: d.kind,
                            title: d.title ?? "",
                            expiresOn: d.expiresOn ?? "",
                          }}
                          document={{ id: d.documentId, filename: d.filename }}
                          wasVerified={d.status === "verified"}
                          label={t("documents.editLabel", { name: name(d) })}
                        />
                        <DeleteDocument aircraftId={id} id={d.id} name={name(d)} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      ))}
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t("documents.privacy")}
      </p>
      {aircraft.status === "draft" && <ContinueLink href={`/owner/aircraft/${id}/requirements`} />}
    </div>
  );
}
