import Link from "next/link";
import { BadgeCheckIcon, CircleAlertIcon, StarIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatSpan } from "@/lib/aircraft/format";
import type { MemberDetail } from "@/lib/admin/member-detail";
import type { Locale } from "@/lib/i18n/config";

function Rating({ avg, count, none }: { avg: number | null; count: number; none: string }) {
  if (!count || avg === null) return <span className="text-muted-foreground">{none}</span>;
  return (
    <span className="flex items-center gap-1">
      <StarIcon className="size-4 text-warning" aria-hidden /> {avg.toFixed(1)} ({count})
    </span>
  );
}

/** Credentials status, declared hours and rating as a pilot. */
export async function PilotCard({ m }: { m: MemberDetail }) {
  const t = await getTranslations("admin.member.pilot");
  const p = m.pilot;
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm">
        {!m.roles.includes("pilot") && <p className="text-muted-foreground">{t("roleOff")}</p>}
        <p className={`flex items-center gap-1.5 ${p.verified ? "text-success" : ""}`}>
          {p.verified ? (
            <BadgeCheckIcon className="size-4" aria-hidden />
          ) : (
            <CircleAlertIcon className="size-4 text-muted-foreground" aria-hidden />
          )}
          {p.verified ? t("verified") : t("notVerified")}
        </p>
        <ul className="grid gap-1 text-muted-foreground">
          <li>{t("credentials", { count: m.credentialCount })}</li>
          {p.pending > 0 && <li className="text-warning">{t("pending", { count: p.pending })}</li>}
          {p.rejected > 0 && <li>{t("rejected", { count: p.rejected })}</li>}
          {p.expiring.length > 0 && <li>{t("expiring", { count: p.expiring.length })}</li>}
        </ul>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-muted-foreground">{t("totalHours")}</dt>
          <dd>{m.totalHours ?? "—"}</dd>
          <dt className="text-muted-foreground">{t("rating")}</dt>
          <dd>
            <Rating avg={m.ratingAvg} count={m.ratingCount} none={t("noRating")} />
          </dd>
        </dl>
      </CardContent>
    </Card>
  );
}

/** Their aircraft with status, and rating as an owner. */
export async function OwnerCard({ m }: { m: MemberDetail }) {
  const t = await getTranslations("admin.member.owner");
  const tp = await getTranslations("admin.member.pilot");
  const ts = await getTranslations("aircraft.statuses");
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        {!m.roles.includes("owner") && <p className="text-muted-foreground">{t("roleOff")}</p>}
        {m.aircraft.length === 0 ? (
          <p className="text-muted-foreground">{t("noAircraft")}</p>
        ) : (
          <ul className="grid gap-1">
            {m.aircraft.map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-2">
                <Link href={`/aircraft/${a.id}`} className="font-medium hover:underline">
                  {a.registration} · {a.manufacturer} {a.model}
                </Link>
                <span className="text-muted-foreground">{ts(a.status)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="flex flex-wrap gap-2">
          <span className="text-muted-foreground">{t("rating")}</span>
          <Rating avg={m.ownerRatingAvg} count={m.ownerRatingCount} none={tp("noRating")} />
        </p>
      </CardContent>
    </Card>
  );
}

/** Booking counts on both sides and the most recent bookings. */
export async function BookingsCard({ m }: { m: MemberDetail }) {
  const t = await getTranslations("admin.member.bookings");
  const tb = await getTranslations("booking.statuses");
  const locale = (await getLocale()) as Locale;
  const cols = ["total", "completed", "open", "cancelled", "late"] as const;
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle as="h2">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-muted-foreground">
              <tr>
                <th scope="col" className="py-1 pr-4 font-normal">
                  <span className="sr-only">{t("title")}</span>
                </th>
                {cols.map((c) => (
                  <th key={c} scope="col" className="py-1 pr-4 font-normal">
                    {t(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(["asPilot", "asOwner"] as const).map((side) => (
                <tr key={side} className="border-t">
                  <th scope="row" className="py-1.5 pr-4 font-medium">
                    {t(side)}
                  </th>
                  {cols.map((c) => (
                    <td key={c} className="py-1.5 pr-4 tabular-nums">
                      {m[side][c]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid gap-1">
          <h3 className="font-medium">{t("recent")}</h3>
          {m.recentBookings.length === 0 ? (
            <p className="text-muted-foreground">{t("none")}</p>
          ) : (
            <ul className="grid gap-1">
              {m.recentBookings.map((b) => (
                <li key={b.id} className="flex flex-wrap justify-between gap-2">
                  <span>
                    {b.registration} · {formatSpan(new Date(b.from), new Date(b.to), locale)}{" "}
                    <span className="text-muted-foreground">
                      ({t(`side.${b.asPilot ? "pilot" : "owner"}`)})
                    </span>
                  </span>
                  <span className="text-muted-foreground">{tb(b.status)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
