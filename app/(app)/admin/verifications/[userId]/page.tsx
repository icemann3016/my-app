import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ExternalLinkIcon, FileTextIcon, ShieldAlertIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { ExpiryText, StatusBadge } from "@/components/pilot/status-badge";
import { UserAvatar } from "@/components/user-avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getReviewHistory } from "@/lib/admin/verifications";
import { avatarUrl } from "@/lib/avatar-url";
import { requireAdmin } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { profiles, users } from "@/lib/db/schema";
import { intlLocale } from "@/lib/i18n/config";
import { countryName } from "@/lib/pilot/catalog";
import { getPilotCredentials } from "@/lib/pilot/credentials";
import { type CredentialKind, credentialLabel, type PilotTranslate } from "@/lib/pilot/labels";
import { expiryState } from "@/lib/pilot/validity";
import { ReviewForm } from "./review-form";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.review");
  return { title: t("metaTitle") };
}

type Item = {
  kind: CredentialKind;
  id: string;
  name: string;
  status: "pending" | "verified" | "rejected";
  version: string;
  fields: { label: string; value: string }[];
  expiresOn: string | null;
  documentId: string | null;
  rejectionReason: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
};

export default async function ReviewPilotPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId: pilotId } = await params;
  const admin = await requireAdmin(`/admin/verifications/${pilotId}`);
  if (!UUID.test(pilotId)) notFound();

  // Account details (email) are private auth data: trusted admin code, owner connection.
  const [pilot] = await getDb()
    .select({
      email: users.email,
      displayName: profiles.displayName,
      avatarKey: profiles.avatarKey,
      createdAt: profiles.createdAt,
    })
    .from(profiles)
    .innerJoin(users, eq(users.id, profiles.id))
    .where(eq(profiles.id, pilotId));
  if (!pilot) notFound();

  const t = await getTranslations("admin.review");
  const tp = await getTranslations("pilot");
  const tl = tp as unknown as PilotTranslate;
  const locale = await getLocale();
  const creds = await getPilotCredentials(pilotId, admin.userId);
  const dateFormat = new Intl.DateTimeFormat(intlLocale(locale), {
    dateStyle: "medium",
    timeZone: "UTC",
  });
  const dateTimeFormat = new Intl.DateTimeFormat(intlLocale(locale), {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
  const day = (d: string | null) => (d ? dateFormat.format(new Date(`${d}T00:00:00Z`)) : "—");
  const country = (code: string) => `${countryName(code, locale)} (${code})`;

  // Reviewer names
  const reviewerIds = [
    ...new Set(
      [...creds.licences, ...creds.ratings, ...creds.medicals]
        .map((c) => c.reviewedBy)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const reviewers = new Map<string, string>();
  for (const id of reviewerIds) {
    const [r] = await getDb()
      .select({ name: profiles.displayName })
      .from(profiles)
      .where(eq(profiles.id, id));
    if (r) reviewers.set(id, r.name);
  }

  const common = (c: {
    id: string;
    status: Item["status"];
    updatedAt: Date;
    documentId: string | null;
    rejectionReason: string | null;
    reviewedBy: string | null;
    reviewedAt: Date | null;
  }) => ({
    id: c.id,
    status: c.status,
    version: c.updatedAt.toISOString(),
    documentId: c.documentId,
    rejectionReason: c.rejectionReason,
    reviewedBy: c.reviewedBy ? (reviewers.get(c.reviewedBy) ?? "—") : null,
    reviewedAt: c.reviewedAt,
  });

  const items: Item[] = [
    ...creds.licences.map((l) => ({
      ...common(l),
      kind: "licence" as const,
      name: credentialLabel({ kind: "licence", type: l.type }, tl),
      expiresOn: l.expiresOn,
      fields: [
        { label: tp("licences.number"), value: l.number },
        { label: tp("fields.issuingState"), value: country(l.issuingState) },
        { label: tp("licences.issuedOn"), value: day(l.issuedOn) },
        { label: tp("licences.expiresOn"), value: day(l.expiresOn) },
      ],
    })),
    ...creds.medicals.map((m) => ({
      ...common(m),
      kind: "medical" as const,
      name: credentialLabel({ kind: "medical", class: m.class }, tl),
      expiresOn: m.validUntil,
      fields: [
        { label: tp("fields.issuingState"), value: country(m.issuingState) },
        { label: tp("medical.validUntil"), value: day(m.validUntil) },
      ],
    })),
    ...creds.ratings.map((r) => ({
      ...common(r),
      kind: "rating" as const,
      name: credentialLabel({ kind: "rating", ratingKind: r.kind, code: r.code }, tl),
      expiresOn: r.expiresOn,
      fields: [
        { label: tp("ratings.kind"), value: tp(`ratings.kinds.${r.kind}`) },
        { label: tp("ratings.expiresOn"), value: day(r.expiresOn) },
      ],
    })),
  ];
  // Pending first, then the rest in their natural order.
  items.sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending"));

  const history = await getReviewHistory(admin.userId, [
    ...items.map((i) => i.id),
    ...creds.documentsById.keys(),
  ]);
  const itemNames = new Map(items.map((i) => [i.id, i.name]));

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-10">
      <Button variant="ghost" size="sm" className="-ml-3 justify-self-start" asChild>
        <Link href="/admin/verifications">
          <ArrowLeftIcon aria-hidden /> {t("back")}
        </Link>
      </Button>

      <div className="flex flex-wrap items-center gap-4">
        <UserAvatar name={pilot.displayName} url={avatarUrl(pilot.avatarKey)} size={56} />
        <div className="grid min-w-0 gap-0.5">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("title", { name: pilot.displayName })}
          </h1>
          <p className="text-sm break-all text-muted-foreground">{pilot.email}</p>
          <p className="text-sm text-muted-foreground">
            {t("memberSince", { date: dateFormat.format(pilot.createdAt) })}
          </p>
        </div>
        <Button variant="outline" size="sm" className="ml-auto" asChild>
          <Link href={`/u/${pilotId}`} target="_blank">
            {t("publicProfile")} <ExternalLinkIcon aria-hidden />
          </Link>
        </Button>
      </div>

      <Alert>
        <ShieldAlertIcon />
        <AlertDescription>{t("checklist")}</AlertDescription>
      </Alert>

      {items.length === 0 && <p className="text-muted-foreground">{t("nothing")}</p>}

      {items.map((item) => {
        const doc = item.documentId ? creds.documentsById.get(item.documentId) : undefined;
        const state = expiryState(item.expiresOn);
        return (
          <Card key={item.id}>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle as="h2">{item.name}</CardTitle>
                <StatusBadge status={item.status} label={tp(`status.${item.status}`)} />
                {state === "expired" || state === "expiring" ? (
                  <ExpiryText
                    state={state}
                    text={tp(`expiry.${state}`, { date: day(item.expiresOn) })}
                  />
                ) : null}
              </div>
              {item.reviewedBy && item.reviewedAt && (
                <CardDescription>
                  {t("reviewedBy", {
                    name: item.reviewedBy,
                    date: dateTimeFormat.format(item.reviewedAt),
                  })}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="grid gap-4">
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                {item.fields.map((f) => (
                  <div key={f.label}>
                    <dt className="text-muted-foreground">{f.label}</dt>
                    <dd className="font-medium break-words">{f.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="text-sm">
                {doc ? (
                  <a
                    href={`/api/documents/${doc.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 font-medium underline-offset-4 hover:underline"
                  >
                    <FileTextIcon className="size-4 text-primary" aria-hidden />
                    {t("openDocument", { name: doc.filename })}
                    <ExternalLinkIcon className="size-3.5 text-muted-foreground" aria-hidden />
                  </a>
                ) : (
                  <span className="text-muted-foreground">{t("noDocument")}</span>
                )}
              </div>
              {item.status === "rejected" && item.rejectionReason && (
                <p className="text-sm text-destructive">
                  {tp("rejectedBecause", { reason: item.rejectionReason })}
                </p>
              )}
              <ReviewForm
                kind={item.kind}
                id={item.id}
                version={item.version}
                name={item.name}
                status={item.status}
              />
            </CardContent>
          </Card>
        );
      })}

      <Card>
        <CardHeader>
          <CardTitle as="h2">{t("experience")}</CardTitle>
          <CardDescription>{t("experienceHint")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          {creds.experience ? (
            <dl className="grid gap-3 sm:grid-cols-3">
              {(["totalHours", "picHours", "last90DaysHours"] as const).map((key) => (
                <div key={key}>
                  <dt className="text-muted-foreground">{tp(`experience.${key}`)}</dt>
                  <dd className="font-medium">{creds.experience![key]}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-muted-foreground">{t("noExperience")}</p>
          )}
          {creds.typeHours.length > 0 && (
            <p>
              {creds.typeHours
                .map((r) => `${r.aircraftType} ${tp("experience.hoursValue", { hours: r.hours })}`)
                .join(" · ")}
            </p>
          )}
        </CardContent>
      </Card>

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
                    {h.action === "credential.verify"
                      ? t("actions.verify", { item: itemNames.get(h.targetId) ?? "—" })
                      : h.action === "credential.reject"
                        ? t("actions.reject", { item: itemNames.get(h.targetId) ?? "—" })
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
