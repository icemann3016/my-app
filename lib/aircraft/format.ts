import { intlLocale, type Locale } from "@/lib/i18n/config";

/** "€185" / "185,50 лв." style price in the viewer's language. */
export function formatPrice(amount: number, currency: string, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency,
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

/** "1 Oct 2026, 08:00 – 12:00" in the airport's zone, and the same span in UTC. */
export function formatSpan(
  from: Date,
  to: Date,
  timeZone: string,
  locale: Locale,
): { local: string; utc: string } {
  const options = { dateStyle: "medium", timeStyle: "short" } as const;
  const local = new Intl.DateTimeFormat(intlLocale(locale), { ...options, timeZone });
  const utc = new Intl.DateTimeFormat(intlLocale(locale), { ...options, timeZone: "UTC" });
  return { local: local.formatRange(from, to), utc: `${utc.formatRange(from, to)} UTC` };
}
