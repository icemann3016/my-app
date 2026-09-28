import { intlLocale, type Locale } from "@/lib/i18n/config";

/** "€185" / "185,50 лв." style price in the viewer's language. */
export function formatPrice(amount: number, currency: string, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency,
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

// Aviation runs on UTC: every date and time in the app is shown (and entered) in UTC, on a
// 24-hour clock, and labelled "UTC".
const utcOptions = { timeZone: "UTC", hourCycle: "h23" } as const;

/** "1 Oct 2026, 08:00 – 12:00 UTC". */
export function formatSpan(from: Date, to: Date, locale: Locale): string {
  const format = new Intl.DateTimeFormat(intlLocale(locale), {
    dateStyle: "medium",
    timeStyle: "short",
    ...utcOptions,
  });
  return `${format.formatRange(from, to)} UTC`;
}

/** "1 Oct 2026, 08:00 UTC" (or only the date with `dateOnly`). */
export function formatUtc(date: Date, locale: Locale, { dateOnly = false } = {}): string {
  const format = new Intl.DateTimeFormat(intlLocale(locale), {
    dateStyle: "medium",
    ...(dateOnly ? {} : { timeStyle: "short" }),
    ...utcOptions,
  });
  return dateOnly ? format.format(date) : `${format.format(date)} UTC`;
}
