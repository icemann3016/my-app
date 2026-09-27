import { intlLocale, type Locale } from "@/lib/i18n/config";

/** "€185" / "185,50 лв." style price in the viewer's language. */
export function formatPrice(amount: number, currency: string, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency,
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}
