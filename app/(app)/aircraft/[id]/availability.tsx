import { CalendarCheckIcon, CalendarXIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { MonthCalendar } from "@/components/aircraft/month-calendar";
import { getBusyPeriods } from "@/lib/aircraft/calendar";
import { formatSpan } from "@/lib/aircraft/format";
import { addMonths, zonedDay, zonedToUtc } from "@/lib/domain/time";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

/** Availability calendar of the listing (SRC-4) and whether the searched period is free. */
export async function Availability({
  aircraftId,
  viewerId,
  timeZone,
  locale,
  month,
  period,
}: {
  aircraftId: string;
  viewerId: string | null;
  timeZone: string;
  locale: Locale;
  /** YYYY-MM to show; defaults to the period's month or this month. */
  month: string | null;
  period: { from: Date; to: Date } | null;
}) {
  const t = await getTranslations("aircraft.availability");
  const shown =
    month ??
    (period ? zonedDay(period.from, timeZone) : zonedDay(new Date(), timeZone)).slice(0, 7);
  const start = zonedToUtc(`${shown}-01`, timeZone)!;
  const end = zonedToUtc(`${addMonths(shown, 1)}-01`, timeZone)!;
  const busy = await getBusyPeriods(viewerId, aircraftId, start, end);

  let periodFree: boolean | null = null;
  if (period) {
    const overlapping = await getBusyPeriods(viewerId, aircraftId, period.from, period.to);
    periodFree = overlapping.length === 0;
  }
  const span = period ? formatSpan(period.from, period.to, timeZone, locale) : null;

  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-semibold">{t("title")}</h2>
      {span && (
        <p
          className={cn(
            "flex items-start gap-2 rounded-md border p-3 text-sm",
            periodFree
              ? "border-success/40 text-success"
              : "border-destructive/40 text-destructive",
          )}
        >
          {periodFree ? (
            <CalendarCheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          ) : (
            <CalendarXIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          )}
          <span>
            {periodFree ? t("free", { when: span.local }) : t("busy", { when: span.local })}
            <span className="block text-xs opacity-80">{span.utc}</span>
          </span>
        </p>
      )}
      <div className="rounded-lg border p-3 sm:max-w-md">
        <MonthCalendar
          month={shown}
          timeZone={timeZone}
          locale={locale}
          spans={busy}
          mode="public"
          basePath={`/aircraft/${aircraftId}`}
        />
      </div>
    </section>
  );
}
