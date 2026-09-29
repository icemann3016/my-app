"use client";

import { useRef, useTransition } from "react";
import { GlobeIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { setLanguage } from "@/app/(auth)/actions";
import { locales } from "@/lib/i18n/config";

/** Language picker in the footer. Works for visitors and logged-in users. */
export function LanguageSwitcher() {
  const t = useTranslations("common");
  const locale = useLocale();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form ref={formRef} action={setLanguage} className="flex items-center gap-1.5">
      <GlobeIcon className="size-4" aria-hidden />
      <label htmlFor="language-switcher" className="sr-only">
        {t("footer.language")}
      </label>
      {/* key: after the action React resets the form to its defaults; a new key makes the
          default the language now in use (else it jumps back to the previous one). */}
      <select
        key={locale}
        id="language-switcher"
        name="locale"
        defaultValue={locale}
        disabled={pending}
        onChange={() => startTransition(() => formRef.current?.requestSubmit())}
        className="rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground"
      >
        {locales.map((l) => (
          <option key={l} value={l}>
            {t(`languages.${l}`)}
          </option>
        ))}
      </select>
    </form>
  );
}
