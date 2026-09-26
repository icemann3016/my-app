import { createTranslator } from "next-intl";

import { defaultLocale, isLocale, type Locale } from "@/lib/i18n/config";
import { siteConfig } from "@/lib/site";
import bg from "@/messages/bg.json";
import en from "@/messages/en.json";

const catalogs = { en, bg } satisfies Record<Locale, typeof en>;

function translator(locale: string | null | undefined) {
  const l = isLocale(locale) ? locale : defaultLocale;
  return createTranslator({ locale: l, messages: catalogs[l], namespace: "email" });
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function build(
  kind: "verify" | "reset",
  { name, url, locale }: { name: string; url: string; locale?: string | null },
) {
  const t = translator(locale);
  const app = siteConfig.name;
  const greeting = t(`${kind}.greeting`, { name });
  const body = t(`${kind}.body`, { app });
  const cta = t(`${kind}.cta`);
  const fallback = t("linkFallback");
  return {
    subject: t(`${kind}.subject`, { app }),
    text: `${greeting}\n\n${body}\n\n${url}\n`,
    html: `<p>${escapeHtml(greeting)}</p>
<p>${escapeHtml(body)}</p>
<p><a href="${url}" style="display:inline-block;padding:10px 16px;background:#0b5bd3;color:#fff;border-radius:6px;text-decoration:none">${escapeHtml(cta)}</a></p>
<p style="color:#666;font-size:12px">${escapeHtml(fallback)}<br>${url}</p>`,
  };
}

export const verifyEmailEmail = (args: { name: string; url: string; locale?: string | null }) =>
  build("verify", args);
export const resetPasswordEmail = (args: { name: string; url: string; locale?: string | null }) =>
  build("reset", args);
