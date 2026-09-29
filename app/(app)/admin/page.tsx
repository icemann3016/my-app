import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { TestErrorButton } from "@/components/admin/test-error-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMetrics } from "@/lib/admin/metrics";
import { requireAdmin } from "@/lib/auth/session";
import { intlLocale } from "@/lib/i18n/config";
import { monitoringConfigured } from "@/lib/monitoring";
import { AdminHeader } from "./page-header";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.dashboard");
  return { title: t("title") };
}

/** Basic numbers for the team (ADM-4): sign-ups, listings, bookings, cancellations, reports. */
export default async function AdminDashboardPage() {
  await requireAdmin("/admin");
  const t = await getTranslations("admin.dashboard");
  const tm = await getTranslations("admin.monitoring");
  const m = await getMetrics(30);
  const intl = intlLocale(await getLocale());
  const num = new Intl.NumberFormat(intl);
  const pct = new Intl.NumberFormat(intl, { style: "percent" });
  const weekLabel = new Intl.DateTimeFormat(intl, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const max = Math.max(1, ...m.signupsByWeek.map((w) => w.n));
  const tiles = [
    { key: "users", value: num.format(m.users), sub: t("newUsers", { count: m.newUsers }) },
    {
      key: "roles",
      value: `${num.format(m.pilots)} / ${num.format(m.owners)}`,
      sub: t("rolesSub"),
    },
    { key: "listed", value: num.format(m.listedAircraft), sub: t("listedSub") },
    {
      key: "bookings",
      value: num.format(m.requested),
      sub: t("bookingsSub", {
        accepted: m.accepted,
        rate: pct.format(m.requested ? m.accepted / m.requested : 0),
      }),
    },
    {
      key: "completed",
      value: num.format(m.completed),
      sub: t("reviewsSub", { count: m.reviews }),
    },
    {
      key: "cancelled",
      value: num.format(m.cancelled),
      sub: t("cancelledSub", { late: m.lateCancelled, declined: m.declinedOrExpired }),
    },
  ] as const;

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8">
      <AdminHeader title={t("title")} text={t("description")} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/admin/reports" className="rounded-lg border p-4 hover:bg-accent">
          <p className="text-sm text-muted-foreground">{t("openReports")}</p>
          <p className="text-2xl font-semibold">{num.format(m.openReports)}</p>
        </Link>
        <Link href="/admin/verifications" className="rounded-lg border p-4 hover:bg-accent">
          <p className="text-sm text-muted-foreground">{t("pendingVerifications")}</p>
          <p className="text-2xl font-semibold">{num.format(m.pendingVerifications)}</p>
        </Link>
      </div>
      <section aria-labelledby="last-30" className="grid gap-3">
        <h2 id="last-30" className="text-lg font-semibold">
          {t("last30")}
        </h2>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {tiles.map((tile) => (
            <div key={tile.key} className="rounded-lg border p-4">
              <dt className="text-sm text-muted-foreground">{t(`tiles.${tile.key}`)}</dt>
              <dd className="text-2xl font-semibold">{tile.value}</dd>
              <dd className="text-xs text-muted-foreground">{tile.sub}</dd>
            </div>
          ))}
        </dl>
      </section>
      <Card>
        <CardHeader>
          <CardTitle as="h2">{t("signups")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="flex h-40 items-end gap-2" aria-label={t("signups")}>
            {m.signupsByWeek.map((w) => (
              <li
                key={w.week}
                className="flex h-full flex-1 flex-col items-center justify-end gap-1"
              >
                <span className="text-xs font-medium">{w.n}</span>
                <span
                  className="w-full rounded-t bg-primary/80"
                  style={{ height: `${(w.n / max) * 100}%`, minHeight: 2 }}
                  aria-hidden
                />
                <span className="text-[10px] text-muted-foreground">
                  <span className="sr-only">{t("weekOf")} </span>
                  {weekLabel.format(new Date(`${w.week}T00:00:00Z`))}
                </span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle as="h2">{tm("title")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <p>{monitoringConfigured() ? tm("configured") : tm("notConfigured")}</p>
          <TestErrorButton />
        </CardContent>
      </Card>
      {m.suspended > 0 && (
        <p className="text-sm text-muted-foreground">{t("suspended", { count: m.suspended })}</p>
      )}
    </div>
  );
}
