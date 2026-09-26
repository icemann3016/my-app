import "server-only";

import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { LOCALE_COOKIE, type Locale } from "./config";

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Remember the language in a cookie (call from Server Actions). */
export async function setLocaleCookie(locale: Locale) {
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
  });
}

/**
 * Zod schemas use message keys (e.g. "emailInvalid") from the "validation" namespace.
 * This turns them into messages in the visitor's language.
 */
export async function localizedFieldErrors(
  error: z.ZodError,
): Promise<Record<string, string[] | undefined>> {
  const t = await getTranslations("validation");
  const raw = z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
  return Object.fromEntries(
    Object.entries(raw).map(([field, messages]) => [
      field,
      messages?.map((key) => (t.has(key as never) ? t(key as never) : t("invalid"))),
    ]),
  );
}
