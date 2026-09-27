import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleAlertIcon, CircleCheckIcon, CircleIcon, ClockIcon, InfoIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DOCUMENT_KINDS,
  DOCUMENT_PROBLEMS,
  PROBLEM_SECTION,
  aircraftTitle,
} from "@/lib/aircraft/catalog";
import { getAircraftForOwner } from "@/lib/aircraft/queries";
import { requireProfile } from "@/lib/auth/session";
import { intlLocale } from "@/lib/i18n/config";
import { StatusActions } from "../_components/status-actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { userId } = await requireProfile(`/owner/aircraft/${id}`);
  const data = await getAircraftForOwner(userId, id).catch(() => null);
  return { title: data ? aircraftTitle(data.aircraft) : undefined };
}

type Item = { key: string; text: string; href?: string; state: "todo" | "waiting" | "problem" };

export default async function AircraftOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId } = await requireProfile(`/owner/aircraft/${id}`);
  const data = await getAircraftForOwner(userId, id);
  if (!data) notFound();
  const { aircraft: a, problems, documents } = data;
  const t = await getTranslations("owner.overview");
  const td = await getTranslations("owner.documents");
  const dateFormat = new Intl.DateTimeFormat(intlLocale(await getLocale()), {
    dateStyle: "medium",
    timeZone: "UTC",
  });
  const base = `/owner/aircraft/${a.id}`;

  const items: Item[] = problems
    .filter((p) => !(DOCUMENT_PROBLEMS as readonly string[]).includes(p))
    .map((p) => ({
      key: p,
      text: t(`problems.${p}` as "problems.model"),
      href: `${base}/${PROBLEM_SECTION[p]}`,
      state: "todo",
    }));
  for (const kind of DOCUMENT_KINDS) {
    if (!problems.includes(kind)) continue;
    const doc = documents.find((d) => d.kind === kind);
    const name = td(`kinds.${kind}`);
    const href = `${base}/documents`;
    if (!doc) items.push({ key: kind, text: t("docMissing", { name }), href, state: "todo" });
    else if (doc.status === "pending") {
      items.push({ key: kind, text: t("docPending", { name }), state: "waiting" });
    } else if (doc.status === "rejected") {
      items.push({ key: kind, text: t("docRejected", { name }), href, state: "problem" });
    } else {
      const date = doc.expiresOn ? dateFormat.format(new Date(`${doc.expiresOn}T00:00:00Z`)) : "";
      items.push({ key: kind, text: t("docExpired", { name, date }), href, state: "problem" });
    }
  }

  const expired = a.status === "unlisted" && a.statusReason === "documents_expired";
  const statusText =
    a.status === "listed"
      ? t("listed", { date: a.listedAt ? dateFormat.format(a.listedAt) : "" })
      : a.status === "paused"
        ? t("paused")
        : a.status === "grounded"
          ? t("grounded")
          : expired
            ? t("unlistedExpired")
            : a.status === "unlisted"
              ? t("unlisted")
              : a.publishRequestedAt
                ? t("publishRequested")
                : problems.length
                  ? t("draftTodo")
                  : t("draftReady");

  const icons = { todo: CircleIcon, waiting: ClockIcon, problem: CircleAlertIcon };
  const iconClass = {
    todo: "text-muted-foreground",
    waiting: "text-warning",
    problem: "text-destructive",
  };

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle as="h2">{t("title")}</CardTitle>
          <CardDescription>{statusText}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          {items.length > 0 && a.status !== "listed" && (
            <ul className="grid gap-2" aria-label={t("checklist")}>
              {items.map((item) => {
                const Icon = icons[item.state];
                return (
                  <li key={item.key} className="flex items-start gap-2 text-sm">
                    <Icon
                      className={`mt-0.5 size-4 shrink-0 ${iconClass[item.state]}`}
                      aria-hidden
                    />
                    {item.href ? (
                      <Link href={item.href} className="underline-offset-4 hover:underline">
                        {item.text}
                      </Link>
                    ) : (
                      <span>{item.text}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {items.length === 0 && a.status !== "listed" && (
            <p className="flex items-center gap-2 text-sm text-success">
              <CircleCheckIcon className="size-4" aria-hidden /> {t("allDone")}
            </p>
          )}
          <StatusActions
            id={a.id}
            status={a.status}
            publishRequested={Boolean(a.publishRequestedAt)}
            registration={a.registration}
          />
        </CardContent>
      </Card>
      <Alert>
        <InfoIcon />
        <AlertDescription>{t("bookingsSoon")}</AlertDescription>
      </Alert>
    </div>
  );
}
