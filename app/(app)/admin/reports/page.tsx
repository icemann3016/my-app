import type { Metadata } from "next";
import Link from "next/link";
import { InboxIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { ModerationButton } from "@/components/admin/moderation-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatUtc } from "@/lib/aircraft/format";
import { listReports } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/session";
import type { ReportStatus } from "@/lib/db/schema";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";
import { AdminHeader } from "../page-header";
import { ReportTarget } from "./report-target";

const STATUSES = ["open", "resolved", "dismissed"] as const satisfies readonly ReportStatus[];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.reports");
  return { title: t("title") };
}

/** Reports of reviews, members, listings and messages (ADM-3), oldest open first. */
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin("/admin/reports");
  const { status: wanted } = await searchParams;
  const status = STATUSES.find((s) => s === wanted) ?? "open";
  const t = await getTranslations("admin.reports");
  const tr = await getTranslations("reports");
  const tm = await getTranslations("admin.moderation.ops");
  const locale = (await getLocale()) as Locale;
  const items = await listReports(status);

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8">
      <AdminHeader title={t("title")} text={t("description")} />
      <nav aria-label={t("filter")} className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/reports?status=${s}`}
            aria-current={s === status ? "page" : undefined}
            className={cn(
              "rounded-full border px-3 py-1 text-sm",
              s === status
                ? "border-primary bg-primary text-primary-foreground"
                : "hover:bg-accent",
            )}
          >
            {t(`statuses.${s}`)}
          </Link>
        ))}
      </nav>
      {items.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <InboxIcon className="size-4" aria-hidden /> {t("empty")}
        </p>
      ) : (
        <ul className="grid gap-4">
          {items.map((r) => (
            <li key={r.id}>
              <Card>
                <CardContent className="grid gap-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant="outline">{t(`targets.${r.targetType}`)}</Badge>
                    <span className="font-medium">{tr(`reasons.${r.reason}`)}</span>
                    <span className="text-muted-foreground">
                      · {t("by", { name: r.reporterName ?? t("deletedUser") })} ·{" "}
                      {formatUtc(r.createdAt, locale)}
                    </span>
                  </div>
                  {r.details && <p className="text-sm whitespace-pre-line">“{r.details}”</p>}
                  <div className="rounded-md bg-muted/50 p-3">
                    <ReportTarget target={r.target} reportId={r.id} open={r.status === "open"} />
                  </div>
                  {r.status === "open" ? (
                    <div className="flex flex-wrap gap-2">
                      <ModerationButton
                        op="resolve_report"
                        targetId={r.id}
                        label={tm("resolve_report")}
                      />
                      <ModerationButton
                        op="dismiss_report"
                        targetId={r.id}
                        label={tm("dismiss_report")}
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {t(`statuses.${r.status}`)} ·{" "}
                      {r.resolvedAt && formatUtc(r.resolvedAt, locale)}
                      {r.resolution && ` · ${r.resolution}`}
                    </p>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
