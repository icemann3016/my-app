import { CloudSunIcon, TriangleAlertIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatUtc } from "@/lib/aircraft/format";
import { intlLocale, type Locale } from "@/lib/i18n/config";
import { type Airfield, bookingWeather } from "@/lib/weather";
import type { TafPeriod } from "@/lib/weather/parse";
import { hasValidIr } from "@/lib/weather/pilot";

/**
 * Weather warnings for a booking (decision 2026-09-27): TAF from 30 h before departure, METAR
 * from 3 h before, for every airfield of the flight. Warnings only; the pilot in command
 * decides. The pilot also learns whether their own IR covers it (owners never see that).
 */
export async function WeatherCard({
  userId,
  isPilot,
  route,
  period,
  aircraftIfr,
}: {
  userId: string;
  isPilot: boolean;
  route: Airfield[];
  period: { from: Date; to: Date };
  aircraftIfr: boolean;
}) {
  const weather = await bookingWeather(route, period);
  if (weather.stage === "past") return null;
  const t = await getTranslations("weather");
  const locale = (await getLocale()) as Locale;
  const hm = new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "UTC",
  });
  const span = (p: TafPeriod) => `${hm.format(p.from)}–${hm.format(p.to)} UTC`;
  const details = (p: TafPeriod) =>
    [
      p.visibilityM !== undefined && t("visibility", { m: p.visibilityM }),
      p.ceilingFt != null && t("ceiling", { ft: p.ceilingFt }),
    ]
      .filter(Boolean)
      .join(", ");
  const ir = weather.stage === "now" && weather.below && isPilot ? await hasValidIr(userId) : true;

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2" className="flex items-center gap-2">
          <CloudSunIcon className="size-5" aria-hidden /> {t("title")}
        </CardTitle>
        <CardDescription>{t("disclaimer")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm">
        {weather.stage === "later" ? (
          <p className="text-muted-foreground">
            {t("later", { date: formatUtc(weather.showsAt, locale) })}
          </p>
        ) : (
          <>
            {weather.below && (
              <Alert variant="destructive">
                <TriangleAlertIcon />
                <AlertDescription className="grid gap-1">
                  <span>{t("belowVfr")}</span>
                  {!aircraftIfr && <span>{t("aircraftNotIfr")}</span>}
                  {isPilot && !ir && <span>{t("noIr")}</span>}
                </AlertDescription>
              </Alert>
            )}
            {weather.unavailable && <p className="text-muted-foreground">{t("unavailable")}</p>}
            <ul className="grid gap-4">
              {weather.fields.map(({ field, metar, taf }) => (
                <li key={field.ident} className="grid gap-2">
                  <p className="font-medium">
                    <span className="font-mono">{field.code}</span> {field.name}
                  </p>
                  {metar === null && taf === null && (
                    <p className="text-muted-foreground">{t("noReport")}</p>
                  )}
                  {[metar, taf].map((r) =>
                    r && r.distanceKm !== null ? (
                      <p key={r.raw} className="text-xs text-muted-foreground">
                        {t("nearest", { station: r.station, km: r.distanceKm })}
                      </p>
                    ) : null,
                  )}
                  {metar && (
                    <div className="grid gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">METAR</span>
                        <Badge variant={metar.below ? "outline" : "secondary"}>
                          {metar.below ? t("belowShort") : t("vfr")}
                        </Badge>
                      </div>
                      <code className="rounded bg-muted px-2 py-1 font-mono text-xs break-words">
                        {metar.raw}
                      </code>
                    </div>
                  )}
                  {taf && (
                    <div className="grid gap-1">
                      <span className="text-xs font-medium">TAF</span>
                      {taf.warnings.length === 0 ? (
                        <p className="text-muted-foreground">{t("tafOk")}</p>
                      ) : (
                        <ul className="grid gap-1">
                          {taf.warnings.map((p, i) => (
                            <li key={i}>
                              <span className="font-medium">
                                {t(`kinds.${p.kind}`, { p: p.probability ?? 0 })}
                              </span>{" "}
                              {span(p)}: {details(p)}
                            </li>
                          ))}
                        </ul>
                      )}
                      <details>
                        <summary className="cursor-pointer text-xs text-muted-foreground">
                          {t("rawTaf")}
                        </summary>
                        <code className="mt-1 block rounded bg-muted px-2 py-1 font-mono text-xs break-words">
                          {taf.raw}
                        </code>
                      </details>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
