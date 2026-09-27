import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import type { CalendarEntryKind } from "@/lib/db/schema";
import { addDays, addMonths, daysOfMonth, zonedDay, zonedToUtc } from "@/lib/domain/time";
import { intlLocale, type Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

export type CalendarSpan = { from: Date; to: Date; kind?: CalendarEntryKind };

const KIND_STYLES: Record<CalendarEntryKind, string> = {
  booking: "bg-primary",
  owner_use: "bg-sky-500",
  maintenance: "bg-warning",
  unavailable: "bg-muted-foreground",
};

/** How much of each local day [start, end) is covered by the spans, 0…1. */
function coverage(spans: CalendarSpan[], start: number, end: number): number {
  const parts = spans
    .map((s) => [Math.max(s.from.getTime(), start), Math.min(s.to.getTime(), end)] as const)
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);
  let covered = 0;
  let until = start;
  for (const [a, b] of parts) {
    if (b <= until) continue;
    covered += b - Math.max(a, until);
    until = b;
  }
  return covered / (end - start);
}

/**
 * Month view of an aircraft's calendar in the airport's time zone. "owner" shows what each
 * entry is; "public" only whether a day is free, partly busy or busy (SRC-4, SRC-5).
 */
export async function MonthCalendar({
  month,
  timeZone,
  locale,
  spans,
  mode,
  basePath,
}: {
  /** YYYY-MM */
  month: string;
  timeZone: string;
  locale: Locale;
  spans: CalendarSpan[];
  mode: "owner" | "public";
  /** Page URL; months are linked as `${basePath}?month=YYYY-MM`. */
  basePath: string;
}) {
  const t = await getTranslations("aircraft.calendar");
  const intl = intlLocale(locale);
  const days = daysOfMonth(month);
  const today = zonedDay(new Date(), timeZone);
  const firstWeekday = (new Date(`${days[0]}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  // 2024-01-01 was a Monday.
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(intl, { weekday: "short", timeZone: "UTC" }).format(
      new Date(Date.UTC(2024, 0, 1 + i)),
    ),
  );
  const title = new Intl.DateTimeFormat(intl, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));
  const dayLabel = new Intl.DateTimeFormat(intl, {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });

  const cells = days.map((day) => {
    const start = zonedToUtc(day, timeZone)!.getTime();
    const end = zonedToUtc(addDays(day, 1), timeZone)!.getTime();
    const inDay = spans.filter((s) => s.from.getTime() < end && s.to.getTime() > start);
    const share = coverage(inDay, start, end);
    const state = share >= 0.999 ? "busy" : share > 0 ? "partly" : "free";
    const kinds = [...new Set(inDay.map((s) => s.kind).filter(Boolean))] as CalendarEntryKind[];
    return { day, state, kinds, past: day < today, isToday: day === today };
  });

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`${basePath}?month=${addMonths(month, -1)}`} aria-label={t("previous")}>
            <ChevronLeftIcon aria-hidden />
          </Link>
        </Button>
        <h2 className="font-semibold capitalize" aria-live="polite">
          {title}
        </h2>
        <Button variant="ghost" size="icon" asChild>
          <Link href={`${basePath}?month=${addMonths(month, 1)}`} aria-label={t("next")}>
            <ChevronRightIcon aria-hidden />
          </Link>
        </Button>
      </div>
      <ol className="grid grid-cols-7 gap-1 text-center text-sm">
        {weekdays.map((w) => (
          <li key={w} className="pb-1 text-xs font-medium text-muted-foreground" aria-hidden>
            {w}
          </li>
        ))}
        {Array.from({ length: firstWeekday }, (_, i) => (
          <li key={`blank-${i}`} aria-hidden />
        ))}
        {cells.map((c) => (
          <li
            key={c.day}
            className={cn(
              "flex aspect-square flex-col items-center justify-center gap-1 rounded-md border text-sm",
              c.past && "opacity-50",
              c.isToday && "border-primary font-semibold",
              mode === "public" &&
                c.state === "busy" &&
                "bg-muted text-muted-foreground line-through",
              mode === "public" && c.state === "partly" && "bg-warning/15",
            )}
          >
            <span aria-hidden>{Number(c.day.slice(8))}</span>
            {mode === "owner" && c.kinds.length > 0 && (
              <span className="flex gap-0.5" aria-hidden>
                {c.kinds.map((k) => (
                  <span key={k} className={cn("size-1.5 rounded-full", KIND_STYLES[k])} />
                ))}
              </span>
            )}
            <span className="sr-only">
              {dayLabel.format(new Date(`${c.day}T00:00:00Z`))}:{" "}
              {mode === "owner" && c.kinds.length
                ? c.kinds.map((k) => t(`kinds.${k}`)).join(", ")
                : t(`states.${c.state as "free"}`)}
            </span>
          </li>
        ))}
      </ol>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {mode === "owner"
          ? (Object.keys(KIND_STYLES) as CalendarEntryKind[]).map((k) => (
              <li key={k} className="inline-flex items-center gap-1.5">
                <span className={cn("size-2 rounded-full", KIND_STYLES[k])} aria-hidden />
                {t(`kinds.${k}`)}
              </li>
            ))
          : (["free", "partly", "busy"] as const).map((s) => (
              <li key={s} className="inline-flex items-center gap-1.5">
                <span
                  className={cn(
                    "size-3 rounded-sm border",
                    s === "partly" && "bg-warning/15",
                    s === "busy" && "bg-muted",
                  )}
                  aria-hidden
                />
                {t(`states.${s}`)}
              </li>
            ))}
      </ul>
      <p className="text-xs text-muted-foreground">{t("timeZone", { zone: timeZone })}</p>
    </div>
  );
}
