import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { LOCALE_COOKIE, resolveLocale } from "@/lib/i18n/config";

// Language for each request (next-intl). No locale in the URL: the choice is stored in a cookie
// (and in user_settings for logged-in users), otherwise we follow the browser.
export default getRequestConfig(async () => {
  const locale = resolveLocale(
    (await cookies()).get(LOCALE_COOKIE)?.value,
    (await headers()).get("accept-language"),
  );
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
