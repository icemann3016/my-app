import type { Metadata } from "next";
import Link from "next/link";
import { MapPinIcon, PlaneIcon, PlusIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { AircraftStatusBadge } from "@/components/aircraft/aircraft-status-badge";
import { OwnerRoleCard } from "@/components/aircraft/owner-role-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatPrice } from "@/lib/aircraft/format";
import { listOwnAircraft, type OwnAircraftSummary } from "@/lib/aircraft/queries";
import { requireProfile } from "@/lib/auth/session";
import type { Locale } from "@/lib/i18n/config";
import { StatusControls } from "./[id]/status-controls";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("aircraft.owner");
  return { title: t("title") };
}

/** Owner dashboard: my aircraft with their status and quick actions (LST-7). */
export default async function MyAircraftPage() {
  const { userId, roles } = await requireProfile("/owner/aircraft");
  const t = await getTranslations("aircraft.owner");
  const isOwner = roles.includes("owner");
  const list = isOwner ? await listOwnAircraft(userId) : [];

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
        {isOwner && (
          <Button asChild>
            <Link href="/owner/aircraft/new">
              <PlusIcon aria-hidden /> {t("add")}
            </Link>
          </Button>
        )}
      </div>

      {!isOwner && <OwnerRoleCard />}
      {isOwner && list.length === 0 && (
        <Card>
          <CardContent className="grid justify-items-start gap-3">
            <PlaneIcon className="size-6 text-primary" aria-hidden />
            <p className="font-medium">{t("emptyTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("emptyText")}</p>
          </CardContent>
        </Card>
      )}
      {list.length > 0 && (
        <ul className="grid gap-4">
          {list.map((a) => (
            <li key={a.id}>
              <AircraftCard aircraft={a} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function AircraftCard({ aircraft: a }: { aircraft: OwnAircraftSummary }) {
  const t = await getTranslations("aircraft");
  const locale = (await getLocale()) as Locale;
  const href = `/owner/aircraft/${a.id}`;
  const quick =
    a.status === "listed" ? ["paused" as const] : a.status === "paused" ? ["listed" as const] : [];

  return (
    <Card className="overflow-hidden py-0">
      <div className="flex flex-col sm:flex-row">
        <Link href={href} className="block shrink-0 bg-muted sm:w-48" tabIndex={-1} aria-hidden>
          {a.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- storage URLs vary by provider
            <img src={a.coverUrl} alt="" className="aspect-[4/3] size-full object-cover" />
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center text-muted-foreground">
              <PlaneIcon className="size-8" />
            </div>
          )}
        </Link>
        <div className="grid flex-1 gap-2 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-mono text-lg font-semibold">
              <Link href={href} className="underline-offset-4 hover:underline">
                {a.registration}
              </Link>
            </h2>
            <AircraftStatusBadge status={a.status} label={t(`statuses.${a.status}`)} />
          </div>
          <p className="text-sm text-muted-foreground">
            {a.manufacturer} {a.model}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {a.homeAirportIdent && (
              <span className="inline-flex items-center gap-1">
                <MapPinIcon className="size-3.5" aria-hidden /> {a.homeAirportIdent}
              </span>
            )}
            {a.pricePerHour !== null && (
              <span>
                {t("owner.perHour", { price: formatPrice(a.pricePerHour, a.currency, locale) })} ·{" "}
                {t(`priceBases.${a.priceBasis}`)}
              </span>
            )}
          </div>
          {a.gaps.length > 0 && a.status !== "listed" && (
            <p className="text-sm text-muted-foreground">
              {t("owner.stepsLeft", { count: a.gaps.length })}
            </p>
          )}
          <div className="flex flex-wrap items-start gap-2 pt-1">
            <Button variant="outline" size="sm" asChild>
              <Link href={href}>
                {a.status === "draft" ? t("owner.continue") : t("owner.manage")}
              </Link>
            </Button>
            {quick.length > 0 && (
              <StatusControls
                id={a.id}
                status={a.status}
                actions={quick}
                ready={a.gaps.length === 0}
              />
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
