import { createTranslator } from "next-intl";

import { defaultLocale, intlLocale, isLocale, type Locale } from "@/lib/i18n/config";
import { type CredentialRef, credentialLabel } from "@/lib/pilot/labels";
import { siteConfig } from "@/lib/site";
import bg from "@/messages/bg.json";
import en from "@/messages/en.json";

const catalogs = { en, bg } satisfies Record<Locale, typeof en>;

function localeOf(locale: string | null | undefined): Locale {
  return isLocale(locale) ? locale : defaultLocale;
}

function translator(locale: string | null | undefined) {
  const l = localeOf(locale);
  return createTranslator({ locale: l, messages: catalogs[l], namespace: "email" });
}

/** Credential names ("Class 2 medical") in the email's language. */
function pilotLabel(locale: string | null | undefined, ref: CredentialRef) {
  const l = localeOf(locale);
  const t = createTranslator({ locale: l, messages: catalogs[l], namespace: "pilot" });
  return credentialLabel(ref, (key, values) => t(key as never, values as never));
}

function formatDate(locale: string | null | undefined, date: string) {
  return new Intl.DateTimeFormat(intlLocale(localeOf(locale)), {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

type Parts = {
  subject: string;
  greeting: string;
  paragraphs: string[];
  list?: string[];
  cta: string;
  url: string;
  locale: string | null | undefined;
};

/** Plain text + simple HTML version of an email with one button. */
function render({ subject, greeting, paragraphs, list, cta, url, locale }: Parts) {
  const fallback = translator(locale)("linkFallback");
  const text = [
    greeting,
    ...paragraphs,
    ...(list?.length ? [list.map((item) => `- ${item}`).join("\n")] : []),
    url,
  ].join("\n\n");
  const html = [
    `<p>${escapeHtml(greeting)}</p>`,
    ...paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`),
    list?.length ? `<ul>${list.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>` : "",
    `<p><a href="${url}" style="display:inline-block;padding:10px 16px;background:#0b5bd3;color:#fff;border-radius:6px;text-decoration:none">${escapeHtml(cta)}</a></p>`,
    `<p style="color:#666;font-size:12px">${escapeHtml(fallback)}<br>${url}</p>`,
  ]
    .filter(Boolean)
    .join("\n");
  return { subject, text: `${text}\n`, html };
}

function build(
  kind: "verify" | "reset",
  { name, url, locale }: { name: string; url: string; locale?: string | null },
) {
  const t = translator(locale);
  const app = siteConfig.name;
  return render({
    subject: t(`${kind}.subject`, { app }),
    greeting: t(`${kind}.greeting`, { name }),
    paragraphs: [t(`${kind}.body`, { app })],
    cta: t(`${kind}.cta`),
    url,
    locale,
  });
}

export const verifyEmailEmail = (args: { name: string; url: string; locale?: string | null }) =>
  build("verify", args);
export const resetPasswordEmail = (args: { name: string; url: string; locale?: string | null }) =>
  build("reset", args);

/** Sent to a pilot when an admin verifies or rejects one of their credentials. */
export function credentialReviewedEmail({
  name,
  locale,
  item,
  decision,
  reason,
  url,
}: {
  name: string;
  locale?: string | null;
  item: CredentialRef;
  decision: "verify" | "reject";
  reason?: string | null;
  url: string;
}) {
  const t = translator(locale);
  const label = pilotLabel(locale, item);
  const verified = decision === "verify";
  return render({
    subject: verified
      ? t("credentialReviewed.verifiedSubject", { item: label })
      : t("credentialReviewed.rejectedSubject", { item: label }),
    greeting: t("credentialReviewed.greeting", { name }),
    paragraphs: verified
      ? [t("credentialReviewed.verifiedBody", { item: label })]
      : [
          t("credentialReviewed.rejectedBody", { item: label }),
          t("credentialReviewed.reason", { reason: reason ?? "" }),
          t("credentialReviewed.rejectedNext"),
        ],
    cta: t("credentialReviewed.cta"),
    url,
    locale,
  });
}

/** Sent once per credential, 30 days (or less) before it expires. */
export function expiryReminderEmail({
  name,
  locale,
  items,
  url,
}: {
  name: string;
  locale?: string | null;
  items: { ref: CredentialRef; expiresOn: string }[];
  url: string;
}) {
  const t = translator(locale);
  return render({
    subject: t("expiryReminder.subject", { count: items.length }),
    greeting: t("expiryReminder.greeting", { name }),
    paragraphs: [t("expiryReminder.body")],
    list: items.map((i) =>
      t("expiryReminder.item", {
        item: pilotLabel(locale, i.ref),
        date: formatDate(locale, i.expiresOn),
      }),
    ),
    cta: t("expiryReminder.cta"),
    url,
    locale,
  });
}
