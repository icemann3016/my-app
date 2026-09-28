import { monthDays } from "@/lib/domain/calendar";
import { addMonths, zonedDay } from "@/lib/domain/time";
import type { CalendarEntryKind } from "@/lib/db/schema";
import { intlLocale, type Locale } from "@/lib/i18n/config";
import { CalendarGrid } from "./calendar-grid";

export type CalendarSpan = {
  from: Date;
  to: Date;
  kind: CalendarEntryKind;
  pending?: boolean;
  /** Owner only: pilot's name or the block's note. */
  detail?: string | null;
  /** Owner only: link to the booking. */
  href?: string | null;
};

/**
 * Month view of an aircraft's calendar in UTC days (SRC-4, SRC-5). Everyone sees times and kinds;
 * owners also get details (pilot, note). With `select`, dates can be picked to request a booking
 * (pilots) or block time (owners).
 */
export function MonthCalendar({
  month,
  locale,
  spans,
  mode,
  basePath,
  select = null,
}: {
  /** YYYY-MM */
  month: string;
  locale: Locale;
  spans: CalendarSpan[];
  mode: "owner" | "public";
  /** Page URL; months are linked as `${basePath}?month=YYYY-MM`. */
  basePath: string;
  select?:
    | { kind: "book"; aircraftId: string; canBook: boolean }
    | { kind: "block"; aircraftId: string }
    | null;
}) {
  const intl = intlLocale(locale);
  const days = monthDays(month, spans).map(({ day, state, spans: inDay }) => ({
    day,
    state,
    entries: inDay.map((s) => ({
      from: s.from.toISOString(),
      to: s.to.toISOString(),
      kind: s.kind,
      pending: s.pending ?? false,
      detail: s.detail ?? null,
      href: s.href ?? null,
    })),
  }));
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

  return (
    <CalendarGrid
      title={title}
      weekdays={weekdays}
      firstWeekday={(new Date(`${month}-01T00:00:00Z`).getUTCDay() + 6) % 7}
      days={days}
      today={zonedDay(new Date(), "UTC")}
      locale={intl}
      mode={mode}
      prevHref={`${basePath}?month=${addMonths(month, -1)}`}
      nextHref={`${basePath}?month=${addMonths(month, 1)}`}
      select={select}
    />
  );
}
