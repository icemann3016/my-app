import type messages from "./messages/en.json";
import type { Locale } from "./lib/i18n/config";

// Type-check translation keys and locales everywhere (next-intl).
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}
