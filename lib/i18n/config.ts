/** Supported languages. Add a locale here and a messages/<locale>.json file to add a language. */
export const locales = ["en", "bg", "de", "fr", "it", "es"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

/** Cookie that remembers the chosen language (also for visitors who aren't logged in). */
export const LOCALE_COOKIE = "locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

/** Language for a request: saved choice, else the browser's preferred language, else English. */
export function resolveLocale(
  cookieValue: string | undefined,
  acceptLanguage: string | null,
): Locale {
  if (isLocale(cookieValue)) return cookieValue;
  const preferred = (acceptLanguage ?? "")
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { lang: tag!.toLowerCase().split("-")[0], q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { lang } of preferred) if (isLocale(lang)) return lang;
  return defaultLocale;
}

/** Locale tag for number and date formatting. */
export function intlLocale(locale: Locale): string {
  return INTL_LOCALES[locale];
}

const INTL_LOCALES: Record<Locale, string> = {
  en: "en-GB",
  bg: "bg-BG",
  de: "de-DE",
  fr: "fr-FR",
  it: "it-IT",
  es: "es-ES",
};

/**
 * Languages the help articles and legal pages are written in. Other languages show the English
 * text with a note (content/help, content/legal).
 */
export const contentLocales: readonly Locale[] = ["en", "bg"];

export function hasTranslatedContent(locale: Locale): boolean {
  return contentLocales.includes(locale);
}
