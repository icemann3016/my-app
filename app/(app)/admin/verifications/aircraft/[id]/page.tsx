import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ExternalLinkIcon, FileTextIcon, ShieldAlertIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { ExpiryText, StatusBadge } from "@/components/pilot/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getReviewHistory } from "@/lib/admin/verifications";
import { getAircraftDocuments } from "@/lib/aircraft/documents";
import { isUuid } from "@/lib/aircraft/queries";
import { requireAdmin } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { aircraft, profiles, users } from "@/lib/db/schema";
import { intlLocale, type Locale } from "@/lib/i18n/config";
import { expiryState } from "@/lib/pilot/validity";
import { ReviewForm } from "../../[userId]/review-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.aircraftReview");
  return { title: t("metaTitle") };
}

/** Admin: check an aircraft's CofA, ARC and insurance (LST-6, ADM-1). */
export default async function ReviewAircraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await requireAdmin(`/admin/verifications/aircraft/${id}`);
  if (!isUuid(id)) notFound();

  // The owner's email is private auth data: trusted admin code, owner connection.
  const [plane] = await getDb()
    .select({
      registration: aircraft.registration,
      manufacturer: aircraft.manufacturer,
      model: aircraft.model,
      status: aircraft.status,
      ownerId: aircraft.ownerId,
      ownerName: profiles.displayName,
      ownerEmail: users.email,
    })
    .from(aircraft)
    .innerJoin(profiles, eq(profiles.id, aircraft.ownerId))
    .innerJoin(users, eq(users.id, aircraft.ownerId))
    .where(eq(aircraft.id, id));
  if (!plane) notFound();

  const t = await getTranslations("admin.aircraftReview");
  const ta = await getTranslations("aircraft");
  const locale = (await getLocale()) as Locale;
  const dateFormat = new Intl.DateTimeFormat(intlLocale(locale), {
    dateStyle: "medium",
    timeZone: "UTC",
  });
  const dateTimeFormat = new Intl.DateTimeFormat(intlLocale(locale), {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
  const day = (d: string) => dateFormat.format(new Date(`${d}T00:00:00Z`));

  const docs = (await getAircraftDocuments(admin.userId, id)).filter((d) => d.status !== null);
  docs.sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending"));
  const history = await getReviewHistory(admin.userId, [
    ...docs.map((d) => d.id),
    ...docs.map((d) => d.documentId),
  ]);
  const names = new Map(docs.map((d) => [d.id, ta(`documents.kinds.${d.kind}`)]));

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-10">
      <Button variant="ghost" size="sm" className="-ml-3 justify-self-start" asChild>
        <Link href="/admin/verifications">
          <ArrowLeftIcon aria-hidden /> {t("back")}
        </Link>
      </Button>
      <div className="flex flex-wrap items-center gap-4">
        <div className="grid min-w-0 gap-0.5">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("title", { registration: plane.registration })}
          </h1>
          <p className="text-muted-foreground">
            {plane.manufacturer} {plane.model} · {ta(`statuses.${plane.status}`)}
          </p>
          <p className="text-sm break-all text-muted-foreground">
            {t("owner", { name: plane.ownerName, email: plane.ownerEmail })}
          </p>
        </div>
        <Button variant="outline" size="sm" className="ml-auto" asChild>
          <Link href={`/u/${plane.ownerId}`} target="_blank">
            {t("ownerProfile")} <ExternalLinkIcon aria-hidden />
          </Link>
        </Button>
      </div>

      <Alert>
        <ShieldAlertIcon />
        <AlertDescription>{t("checklist", { registration: plane.registration })}</AlertDescription>
      </Alert>

      {docs.length === 0 && <p className="text-muted-foreground">{t("nothing")}</p>}

      {docs.map((d) => {
        const state = expiryState(d.expiresOn);
        const name = ta(`documents.kinds.${d.kind}`);
        return (
          <Card key={d.id}>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle as="h2">{name}</CardTitle>
                <StatusBadge status={d.status!} label={ta(`documents.status.${d.status!}`)} />
              </div>
              {d.reviewedAt && (
                <CardDescription>
                  {t("reviewedOn", { date: dateTimeFormat.format(d.reviewedAt) })}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {d.expiresOn ? (
                  <ExpiryText
                    state={state}
                    text={ta(`documents.expiry.${state === "none" ? "valid" : state}`, {
                      date: day(d.expiresOn),
                    })}
                  />
                ) : (
                  <span className="text-muted-foreground">{t("noExpiry")}</span>
                )}
                <a
                  href={`/api/documents/${d.documentId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 font-medium underline-offset-4 hover:underline"
                >
                  <FileTextIcon className="size-4 text-primary" aria-hidden />
                  {t("openDocument", { name: d.filename })}
                  <ExternalLinkIcon className="size-3.5 text-muted-foreground" aria-hidden />
                </a>
              </div>
              {d.status === "rejected" && d.rejectionReason && (
                <p className="text-sm text-destructive">
                  {ta("documents.rejectedBecause", { reason: d.rejectionReason })}
                </p>
              )}
              <ReviewForm
                kind="aircraftDocument"
                id={d.id}
                version={d.updatedAt.toISOString()}
                name={name}
                status={d.status!}
                recipient="owner"
              />
            </CardContent>
          </Card>
        );
      })}

      <Card>
        <CardHeader>
          <CardTitle as="h2">{t("history")}</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noHistory")}</p>
          ) : (
            <ul className="grid gap-2 text-sm">
              {history.map((h) => (
                <li key={h.id} className="grid gap-0.5">
                  <span>
                    <span className="font-medium">{h.adminName ?? "—"}</span>{" "}
                    {h.action === "aircraft_document.verify"
                      ? t("actions.verify", { item: names.get(h.targetId) ?? "—" })
                      : h.action === "aircraft_document.reject"
                        ? t("actions.reject", { item: names.get(h.targetId) ?? "—" })
                        : t("actions.viewDocument")}
                    {h.reason ? ` – ${h.reason}` : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {dateTimeFormat.format(h.createdAt)} UTC
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
