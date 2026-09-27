import { intlLocale, isLocale } from "@/lib/i18n/config";

function nf(locale: string) {
  return intlLocale(isLocale(locale) ? locale : "en");
}

/** "€180", "180,00 лв." style, in the viewer's language. Whole amounts without decimals. */
export function formatMoney(amount: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(nf(locale), {
    style: "currency",
    currency,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(value: number, locale: string, maxDecimals = 1): string {
  return new Intl.NumberFormat(nf(locale), { maximumFractionDigits: maxDecimals }).format(value);
}
