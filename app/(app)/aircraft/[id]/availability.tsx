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
  canBook,
  locale,
  month,
  period,
}: {
  aircraftId: string;
  viewerId: string | null;
  /** The viewer may request a booking (listed aircraft, not their own). */
  canBook: boolean;
  locale: Locale;
  /** YYYY-MM to show; defaults to the period's month or this month. */
  month: string | null;
  period: { from: Date; to: Date } | null;
}) {
  const t = await getTranslations("aircraft.availability");
  const shown = month ?? zonedDay(period ? period.from : new Date(), "UTC").slice(0, 7);
  const start = zonedToUtc(`${shown}-01`, "UTC")!;
  const end = zonedToUtc(`${addMonths(shown, 1)}-01`, "UTC")!;
  const busy = await getBusyPeriods(viewerId, aircraftId, start, end);

  let periodFree: boolean | null = null;
  if (period) {
    const overlapping = await getBusyPeriods(viewerId, aircraftId, period.from, period.to);
    periodFree = overlapping.length === 0;
  }
  const span = period ? formatSpan(period.from, period.to, locale) : null;

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
          <span>{periodFree ? t("free", { when: span }) : t("busy", { when: span })}</span>
        </p>
      )}
      <div className="rounded-lg border p-3 sm:max-w-md">
        <MonthCalendar
          month={shown}
          locale={locale}
          spans={busy}
          mode="public"
          basePath={`/aircraft/${aircraftId}`}
          select={{ kind: "book", aircraftId, canBook }}
        />
      </div>
    </section>
  );
}
