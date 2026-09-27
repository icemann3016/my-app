import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeftIcon, InfoIcon, TriangleAlertIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPrice } from "@/lib/aircraft/format";
import { getUnits, isUuid } from "@/lib/aircraft/queries";
import { requireUser } from "@/lib/auth/session";
import { bookingAmount } from "@/lib/bookings/amount";
import { getFlightLog } from "@/lib/bookings/flight-log";
import { getBooking } from "@/lib/bookings/queries";
import { getLogPhoto, logAirports } from "@/lib/bookings/log-view";
import { zonedDay } from "@/lib/domain/time";
import { litresToOil, litresToVolume } from "@/lib/domain/units";
import type { Locale } from "@/lib/i18n/config";
import { CheckoutForm } from "./checkout-form";
import { LegDialog } from "./leg-dialog";
import { LegList } from "./leg-list";
import { OwnerActions, SubmitLog } from "./log-actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("flightLog");
  return { title: t("title") };
}

const num = (v: number | null, round = (x: number) => x) =>
  v === null ? "" : String(Math.round(round(v) * 10) / 10);

/** The flight log of a rental: check-out, legs, check-in and the owner's confirmation (BKG-7, BKG-12). */
export default async function FlightLogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/bookings/${id}/log`);
  if (!isUuid(id)) notFound();
  const detail = await getBooking(user.id, id);
  if (!detail) notFound();
  const { booking: b, period, aircraft: plane, route } = detail;
  const role = b.pilotId === user.id ? "pilot" : b.ownerId === user.id ? "owner" : null;
  if (!role) notFound();
  const data = await getFlightLog(user.id, id);
  if (!data) redirect(`/bookings/${id}`);
  const { log, legs } = data;
  const t = await getTranslations("flightLog");
  const locale = (await getLocale()) as Locale;
  const units = await getUnits(user.id);
  const fuelUnit = t(units === "metric" ? "units.l" : "units.usgal");
  const oilUnit = t(plane.oilUnit === "qt" ? "units.qt" : "units.l");
  const editable =
    role === "pilot" && (log.status === "draft" || log.status === "correction_requested");
  const timeZone = route[0]?.timezone ?? "UTC";
  const result = bookingAmount(b, period, timeZone, legs, log.fuelAdjustment ?? 0);
  const photo = role === "pilot" ? await getLogPhoto(user.id, log.checkoutPhotoId) : null;
  const airports = await logAirports([
    b.departureIdent,
    ...legs.flatMap((l) => [l.fromIdent, l.toIdent]),
  ]);
  const common = { bookingId: b.id, logId: log.id, fuelUnit, oilUnit };

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-10">
      <Button variant="ghost" size="sm" className="-ml-3 justify-self-start" asChild>
        <Link href={`/bookings/${b.id}`}>
          <ArrowLeftIcon aria-hidden /> {t("back")}
        </Link>
      </Button>
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">
          <span className="font-mono">{plane.registration}</span> · {t(`statuses.${log.status}`)}
        </p>
      </div>
      <Alert>
        <InfoIcon />
        <AlertDescription>{t("disclaimer")}</AlertDescription>
      </Alert>
      {log.correctionNote && log.status === "correction_requested" && (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertDescription>{t("correctionNote", { note: log.correctionNote })}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle as="h2">{t("checkout")}</CardTitle>
        </CardHeader>
        <CardContent>
          {editable ? (
            <CheckoutForm
              {...common}
              photo={photo}
              values={{
                hobbsStart: num(log.hobbsStart),
                tachStart: num(log.tachStart),
                fuelStart: num(log.fuelStartL, (l) => litresToVolume(l, units)),
                oilStart: num(log.oilStartL, (l) => litresToOil(l, plane.oilUnit)),
              }}
            />
          ) : (
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              {(
                [
                  [t("hobbs"), num(log.hobbsStart)],
                  [t("tach"), num(log.tachStart)],
                  [
                    t("fuelOnBoard", { unit: fuelUnit }),
                    num(log.fuelStartL, (l) => litresToVolume(l, units)),
                  ],
                  [
                    t("oilLevel", { unit: oilUnit }),
                    num(log.oilStartL, (l) => litresToOil(l, plane.oilUnit)),
                  ],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-medium">{value || "–"}</dd>
                </div>
              ))}
            </dl>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle as="h2">{t("legs")}</CardTitle>
          {editable && legs.length < 50 && (
            <LegDialog
              {...common}
              from={airports[legs.at(-1)?.toIdent ?? b.departureIdent] ?? null}
              to={null}
              values={{ date: zonedDay(new Date(), timeZone), landings: "1" }}
            />
          )}
        </CardHeader>
        <CardContent>
          <LegList
            legs={legs}
            airports={airports}
            units={units}
            dipstick={plane.oilUnit}
            editable={editable}
            {...common}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">{t("summary")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm">
          {result ? (
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">{t(`flown.${b.timeBasis}`)}</dt>
                <dd className="font-medium">
                  {t("duration", { h: Math.floor(result.minutes / 60), m: result.minutes % 60 })}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("billed")}</dt>
                <dd className="font-medium">
                  {t("billedHours", { hours: result.hours })} ×{" "}
                  {formatPrice(result.rate, b.currency, locale)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("amountDue")}</dt>
                <dd className="font-medium">
                  {formatPrice(log.amountDue ?? result.amount, b.currency, locale)}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-destructive">
              {t("missingMeters", { basis: t(`basis.${b.timeBasis}`) })}
            </p>
          )}
          <p className="text-xs text-muted-foreground">{t("payDirectly")}</p>
          {editable && <SubmitLog bookingId={b.id} logId={log.id} disabled={!legs.length} />}
          {role === "owner" && log.status === "submitted" && (
            <OwnerActions bookingId={b.id} logId={log.id} canConfirm={Boolean(result)} />
          )}
          {role === "pilot" && log.status === "submitted" && <p>{t("waitingForOwner")}</p>}
          {role === "owner" &&
            (log.status === "draft" || log.status === "correction_requested") && (
              <p>{t("waitingForPilot")}</p>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
