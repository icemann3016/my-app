import { desc, eq, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ExternalLinkIcon, FileTextIcon, ShieldAlertIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { AircraftStatusBadge } from "@/components/aircraft/aircraft-status-badge";
import { ExpiryText, StatusBadge } from "@/components/pilot/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { aircraftTitle, DOCUMENT_KINDS } from "@/lib/aircraft/catalog";
import { requireAdmin } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { asUser } from "@/lib/db/rls";
import {
  adminActions,
  aircraft,
  aircraftDocuments,
  documents,
  profiles,
  users,
} from "@/lib/db/schema";
import { intlLocale } from "@/lib/i18n/config";
import { expiryState } from "@/lib/pilot/validity";
import { ReviewForm } from "../../_components/review-form";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.aircraftReview");
  return { title: t("metaTitle") };
}

export default async function ReviewAircraftPage({
  params,
}: {
  params: Promise<{ aircraftId: string }>;
}) {
  const { aircraftId } = await params;
  const admin = await requireAdmin(`/admin/verifications/aircraft/${aircraftId}`);
  if (!UUID.test(aircraftId)) notFound();

  // Read as the admin (RLS allows admins); the owner's email comes from the auth tables.
  const data = await asUser(admin.userId, async (tx) => {
    const [a] = await tx.select().from(aircraft).where(eq(aircraft.id, aircraftId));
    if (!a) return null;
    const docs = await tx
      .select({ doc: aircraftDocuments, filename: documents.filename })
      .from(aircraftDocuments)
      .leftJoin(documents, eq(documents.id, aircraftDocuments.documentId))
      .where(eq(aircraftDocuments.aircraftId, aircraftId))
      .orderBy(desc(aircraftDocuments.createdAt));
    return { a, docs };
  });
  if (!data) notFound();
  const { a, docs } = data;
  const [owner] = await getDb()
    .select({ name: profiles.displayName, email: users.email })
    .from(profiles)
    .innerJoin(users, eq(users.id, profiles.id))
    .where(eq(profiles.id, a.ownerId));

  const t = await getTranslations("admin.aircraftReview");
  const tr = await getTranslations("admin.review");
  const tp = await getTranslations("pilot");
  const tdoc = await getTranslations("owner.documents");
  const ts = await getTranslations("aircraft.statuses");
  const locale = await getLocale();
  const day = new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium", timeZone: "UTC" });
  const dayTime = new Intl.DateTimeFormat(intlLocale(locale), {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
  const fmt = (d: string | null) => (d ? day.format(new Date(`${d}T00:00:00Z`)) : "—");

  const history = docs.length
    ? await asUser(admin.userId, (tx) =>
        tx
          .select({
            id: adminActions.id,
            action: adminActions.action,
            targetId: adminActions.targetId,
            reason: adminActions.reason,
            createdAt: adminActions.createdAt,
            adminName: profiles.displayName,
          })
          .from(adminActions)
          .leftJoin(profiles, eq(profiles.id, adminActions.adminId))
          .where(
            inArray(adminActions.targetId, [
              ...docs.map((d) => d.doc.id),
              ...docs.flatMap((d) => (d.doc.documentId ? [d.doc.documentId] : [])),
            ]),
          )
          .orderBy(desc(adminActions.createdAt))
          .limit(50),
      )
    : [];
  const docNames = new Map(docs.map((d) => [d.doc.id, tdoc(`kinds.${d.doc.kind}`)]));

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-10">
      <Button variant="ghost" size="sm" className="-ml-3 justify-self-start" asChild>
        <Link href="/admin/verifications">
          <ArrowLeftIcon aria-hidden /> {tr("back")}
        </Link>
      </Button>
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid min-w-0 gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {t("title", { registration: a.registration })}
            </h1>
            <AircraftStatusBadge status={a.status} label={ts(a.status)} />
          </div>
          <p className="text-sm text-muted-foreground">{aircraftTitle(a)}</p>
          {owner && (
            <p className="text-sm break-all text-muted-foreground">
              {t("owner", { name: owner.name })} · {owner.email}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" className="ml-auto" asChild>
          <Link href={`/aircraft/${a.id}`} target="_blank">
            {t("listing")} <ExternalLinkIcon aria-hidden />
          </Link>
        </Button>
      </div>

      <Alert>
        <ShieldAlertIcon />
        <AlertDescription>{t("checklist", { registration: a.registration })}</AlertDescription>
      </Alert>

      {DOCUMENT_KINDS.map((kind) => {
        const rows = docs.filter((d) => d.doc.kind === kind);
        const name = tdoc(`kinds.${kind}`);
        return (
          <Card key={kind}>
            <CardHeader>
              <CardTitle as="h2">{name}</CardTitle>
              {rows.length === 0 && <CardDescription>{t("notUploaded")}</CardDescription>}
            </CardHeader>
            {rows.length > 0 && (
              <CardContent className="grid gap-6">
                {rows.map(({ doc, filename }) => {
                  const state = expiryState(doc.expiresOn);
                  return (
                    <div key={doc.id} className="grid gap-3">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <StatusBadge status={doc.status} label={tp(`status.${doc.status}`)} />
                        {doc.expiresOn && (
                          <ExpiryText
                            state={state}
                            text={tp(`expiry.${state}` as "expiry.valid", {
                              date: fmt(doc.expiresOn),
                            })}
                          />
                        )}
                        {doc.reviewedAt && (
                          <span className="text-muted-foreground">
                            {tr("reviewedBy", {
                              name: history.find((h) => h.targetId === doc.id)?.adminName ?? "—",
                              date: dayTime.format(doc.reviewedAt),
                            })}
                          </span>
                        )}
                      </div>
                      {doc.documentId ? (
                        <a
                          href={`/api/documents/${doc.documentId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline"
                        >
                          <FileTextIcon className="size-4 text-primary" aria-hidden />
                          {tr("openDocument", { name: filename ?? name })}
                          <ExternalLinkIcon
                            className="size-3.5 text-muted-foreground"
                            aria-hidden
                          />
                        </a>
                      ) : (
                        <span className="text-sm text-muted-foreground">{tr("noDocument")}</span>
                      )}
                      {doc.status === "rejected" && doc.rejectionReason && (
                        <p className="text-sm text-destructive">
                          {tp("rejectedBecause", { reason: doc.rejectionReason })}
                        </p>
                      )}
                      <ReviewForm
                        kind="aircraft_document"
                        id={doc.id}
                        version={doc.updatedAt.toISOString()}
                        name={name}
                        status={doc.status}
                      />
                    </div>
                  );
                })}
              </CardContent>
            )}
          </Card>
        );
      })}

      <Card>
        <CardHeader>
          <CardTitle as="h2">{tr("history")}</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">{tr("noHistory")}</p>
          ) : (
            <ul className="grid gap-2 text-sm">
              {history.map((h) => (
                <li key={h.id} className="grid gap-0.5">
                  <span>
                    <span className="font-medium">{h.adminName ?? "—"}</span>{" "}
                    {h.action === "aircraft_document.verify"
                      ? tr("actions.verify", { item: docNames.get(h.targetId) ?? "—" })
                      : h.action === "aircraft_document.reject"
                        ? tr("actions.reject", { item: docNames.get(h.targetId) ?? "—" })
                        : tr("actions.viewDocument")}
                    {h.reason ? ` – ${h.reason}` : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {dayTime.format(h.createdAt)} UTC
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
