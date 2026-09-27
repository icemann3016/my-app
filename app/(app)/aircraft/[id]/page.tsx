import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckIcon, EyeOffIcon, MapPinIcon, PencilIcon, StarIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { AircraftStatusBadge } from "@/components/aircraft/aircraft-status-badge";
import { PhotoGallery } from "@/components/aircraft/photo-gallery";
import { UserAvatar } from "@/components/user-avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { airportPlace } from "@/lib/airports";
import { aircraftTitle, FUEL_LABELS } from "@/lib/aircraft/catalog";
import { formatMoney, formatNumber } from "@/lib/aircraft/format";
import { getAircraftForViewer } from "@/lib/aircraft/queries";
import { describeRequirements } from "@/lib/aircraft/requirements";
import { avatarUrl } from "@/lib/avatar-url";
import { getUser } from "@/lib/auth/session";
import { isDatabaseConfigured } from "@/lib/db";
import type { PilotTranslate } from "@/lib/pilot/labels";
import { massFromKg, volumeFromLitres } from "@/lib/units";
import { getUserUnits } from "@/lib/units-server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const load = cache(async (id: string) => {
  if (!UUID.test(id) || !isDatabaseConfigured()) return null;
  const viewer = await getUser();
  const data = await getAircraftForViewer(viewer?.id ?? null, id);
  return data ? { ...data, viewerId: viewer?.id ?? null } : null;
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const data = await load((await params).id);
  if (!data) return { title: (await getTranslations("aircraft.page"))("notFound") };
  const a = data.aircraft;
  return {
    title: `${aircraftTitle(a)} (${a.registration})`,
    description: a.description?.slice(0, 160) ?? undefined,
  };
}

export default async function AircraftPage({ params }: { params: Promise<{ id: string }> }) {
  const data = await load((await params).id);
  if (!data) notFound();
  const { aircraft: a, photos, requirements, owner, homeAirport, viewerId } = data;
  const t = await getTranslations("aircraft");
  const tr = (await getTranslations("aircraft.requirements")) as unknown as PilotTranslate;
  const tp = (await getTranslations("pilot")) as unknown as PilotTranslate;
  const locale = await getLocale();
  const units = await getUserUnits();
  const num = (n: number) => formatNumber(n, locale);
  const title = aircraftTitle(a);
  const isOwner = viewerId === a.ownerId;

  const fuel = a.fuelBurnLph !== null ? volumeFromLitres(a.fuelBurnLph, units) : null;
  const load_ = a.usefulLoadKg !== null ? massFromKg(a.usefulLoadKg, units) : null;
  const specs: { label: string; value: string }[] = [
    { label: t("specs.category"), value: t(`categories.${a.category}`) },
    a.seats !== null ? { label: t("specs.seats"), value: String(a.seats) } : null,
    a.year !== null ? { label: t("specs.year"), value: String(a.year) } : null,
    a.icaoType ? { label: t("specs.icaoType"), value: a.icaoType } : null,
    a.engine ? { label: t("specs.engine"), value: a.engine } : null,
    a.fuelType ? { label: t("specs.fuel"), value: FUEL_LABELS[a.fuelType] } : null,
    fuel
      ? {
          label: t("specs.fuelBurn"),
          value: `${num(fuel.value)} ${t(`units.${fuel.unit === "l" ? "litresPerHour" : "usgalPerHour"}`)}`,
        }
      : null,
    a.cruiseKt !== null
      ? { label: t("specs.cruise"), value: `${a.cruiseKt} ${t("units.kt")}` }
      : null,
    load_
      ? { label: t("specs.usefulLoad"), value: `${num(load_.value)} ${t(`units.${load_.unit}`)}` }
      : null,
    a.enduranceH !== null
      ? { label: t("specs.endurance"), value: `${num(a.enduranceH)} ${t("units.h")}` }
      : null,
  ].filter((s): s is { label: string; value: string } => s !== null);

  const equipment = [
    a.avionics,
    a.autopilot ? t("equipment.autopilot") : null,
    a.transponder !== "none" ? t(`transponders.${a.transponder}`) : null,
    a.adsbOut ? t("equipment.adsbOut") : null,
    a.nightVfr ? t("equipment.nightVfr") : null,
    a.ifr ? t("equipment.ifr") : null,
  ].filter(Boolean) as string[];

  const requirementLines = describeRequirements(requirements, a.icaoType, tr, tp, num);

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8">
      {a.status !== "listed" && (
        <Alert>
          <EyeOffIcon />
          <AlertDescription>{t("page.notPublic")}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap items-start gap-3">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
            <span className="font-mono">{a.registration}</span>
            {homeAirport && (
              <span className="flex items-center gap-1" title={airportPlace(homeAirport)}>
                <MapPinIcon className="size-4 text-primary" aria-hidden />
                <span className="font-mono">{homeAirport.code}</span> {homeAirport.name}
              </span>
            )}
            {a.ratingCount > 0 && a.ratingAvg !== null && (
              <span className="flex items-center gap-1">
                <StarIcon className="size-4 fill-current text-amber-500" aria-hidden />
                {a.ratingAvg.toFixed(1)} ({a.ratingCount})
              </span>
            )}
          </p>
        </div>
        {isOwner && (
          <div className="ml-auto flex items-center gap-2">
            <AircraftStatusBadge status={a.status} label={t(`statuses.${a.status}`)} />
            <Button variant="outline" size="sm" asChild>
              <Link href={`/owner/aircraft/${a.id}`}>
                <PencilIcon aria-hidden /> {t("page.edit")}
              </Link>
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="grid min-w-0 gap-6">
          <PhotoGallery photos={photos} title={title} />

          {a.description && (
            <section aria-labelledby="about" className="grid gap-2">
              <h2 id="about" className="text-lg font-semibold">
                {t("page.about")}
              </h2>
              <p className="leading-relaxed whitespace-pre-line">{a.description}</p>
            </section>
          )}

          <section aria-labelledby="specs" className="grid gap-3">
            <h2 id="specs" className="text-lg font-semibold">
              {t("page.specs")}
            </h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              {specs.map((s) => (
                <div key={s.label}>
                  <dt className="text-muted-foreground">{s.label}</dt>
                  <dd className="font-medium">{s.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {(equipment.length > 0 || a.equipmentNotes) && (
            <section aria-labelledby="equipment" className="grid gap-3">
              <h2 id="equipment" className="text-lg font-semibold">
                {t("page.equipment")}
              </h2>
              {equipment.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {equipment.map((e) => (
                    <li
                      key={e}
                      className="flex items-center gap-1 rounded-md border px-2.5 py-1 text-sm"
                    >
                      <CheckIcon className="size-3.5 text-success" aria-hidden /> {e}
                    </li>
                  ))}
                </ul>
              )}
              {a.equipmentNotes && (
                <p className="text-sm whitespace-pre-line text-muted-foreground">
                  {a.equipmentNotes}
                </p>
              )}
            </section>
          )}

          <section aria-labelledby="requirements" className="grid gap-3">
            <h2 id="requirements" className="text-lg font-semibold">
              {t("page.requirements")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("page.requirementsBase")}</p>
            {requirementLines.length > 0 && (
              <ul className="grid gap-1.5 text-sm">
                {requirementLines.map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    {line}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="grid content-start gap-4">
          <Card className="gap-3">
            <CardHeader>
              <CardTitle as="h2" className="text-2xl">
                {a.pricePerHour !== null
                  ? t("page.perHour", { price: formatMoney(a.pricePerHour, a.currency, locale) })
                  : t("page.noPrice")}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <ul className="grid gap-1.5">
                <li>{t(`page.priceBasis.${a.priceBasis}`)}</li>
                <li>{t(`page.timeBasis.${a.timeBasis}`)}</li>
                {a.weekendPricePerHour !== null && (
                  <li>
                    {t("page.weekendPrice", {
                      price: formatMoney(a.weekendPricePerHour, a.currency, locale),
                    })}
                  </li>
                )}
                {a.minHoursPerDay !== null && a.minHoursPerDay > 0 && (
                  <li>{t("page.minHoursPerDay", { hours: num(a.minHoursPerDay) })}</li>
                )}
              </ul>
              <div className="grid gap-1 border-t pt-3">
                <p className="font-medium">{t("page.cancellation")}</p>
                <p className="text-muted-foreground">
                  {a.freeCancellationHours > 0
                    ? t("page.freeCancellation", { hours: a.freeCancellationHours })
                    : t("page.noFreeCancellation")}
                </p>
                {a.cancellationNote && (
                  <p className="whitespace-pre-line text-muted-foreground">{a.cancellationNote}</p>
                )}
              </div>
              <Button disabled className="w-full">
                {t("page.requestSoon")}
              </Button>
              <p className="text-xs text-muted-foreground">{t("page.paymentNote")}</p>
            </CardContent>
          </Card>

          {owner && (
            <Card className="gap-3">
              <CardHeader>
                <CardTitle as="h2">{t("page.owner")}</CardTitle>
              </CardHeader>
              <CardContent>
                <Link
                  href={`/u/${owner.id}`}
                  className="flex items-center gap-3 rounded-md hover:bg-accent/50"
                >
                  <UserAvatar name={owner.displayName} url={avatarUrl(owner.avatarKey)} size={44} />
                  <span className="grid">
                    <span className="font-medium">{owner.displayName}</span>
                    <span className="text-sm text-muted-foreground">
                      {owner.ratingCount > 0 && owner.ratingAvg !== null
                        ? `★ ${owner.ratingAvg.toFixed(1)} (${owner.ratingCount})`
                        : t("page.noRatings")}
                    </span>
                  </span>
                </Link>
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
