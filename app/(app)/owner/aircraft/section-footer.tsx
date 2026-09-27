"use client";

import { useTranslations } from "next-intl";

import { SubmitButton } from "@/components/forms/submit-button";

/** Submit button of a listing section: drafts continue with the next setup step. */
export function SectionFooter({ continues }: { continues: boolean }) {
  const t = useTranslations("aircraft.edit");
  return (
    <div className="flex flex-wrap items-center gap-3 border-t pt-4">
      <SubmitButton pendingText={t("saving")}>
        {continues ? t("saveAndContinue") : t("save")}
      </SubmitButton>
      {continues && <p className="text-sm text-muted-foreground">{t("draftSaved")}</p>}
    </div>
  );
}
