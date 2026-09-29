import type { Metadata } from "next";
import { FileWarningIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { Markdown } from "@/components/help/markdown";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { hasTranslatedContent, type Locale } from "@/lib/i18n/config";
import { getLegalPage, type LegalPage } from "@/lib/legal";

export async function legalMetadata(page: LegalPage): Promise<Metadata> {
  const { title } = await getLegalPage((await getLocale()) as Locale, page);
  return { title };
}

/** A legal page from content/legal, marked as a draft until reviewed by a lawyer. */
export async function LegalPageView({ page }: { page: LegalPage }) {
  const locale = (await getLocale()) as Locale;
  const { title, blocks } = await getLegalPage(locale, page);
  const t = await getTranslations("legal");
  return (
    <article className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <Alert>
        <FileWarningIcon />
        <AlertDescription>
          {t("draft")}
          {!hasTranslatedContent(locale) && <span className="block">{t("englishOnly")}</span>}
        </AlertDescription>
      </Alert>
      <Markdown blocks={blocks} />
    </article>
  );
}
