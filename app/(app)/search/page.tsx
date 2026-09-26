import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ComingSoon } from "@/components/coming-soon";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("placeholders.search");
  return { title: t("title") };
}

export default async function Page() {
  const t = await getTranslations("placeholders.search");
  return (
    <ComingSoon title={t("title")} milestone="M5">
      {t("text")}
    </ComingSoon>
  );
}
