import Link from "next/link";
import { CircleAlertIcon, CircleCheckIcon, InfoIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { getMyEligibility } from "@/lib/aircraft/eligibility";
import { eligibilityText } from "@/lib/aircraft/eligibility-text";
import type { PilotTranslate } from "@/lib/pilot/labels";

/**
 * "Can I rent this?" for the logged-in pilot: exactly which requirement fails (RAT-8), checked
 * for the searched period or today. Visitors are asked to log in.
 */
export async function EligibilityCard({
  aircraftId,
  typeDesignator,
  viewerId,
  period,
  loginNext,
}: {
  aircraftId: string;
  typeDesignator: string;
  viewerId: string | null;
  period: { from: Date; to: Date } | null;
  loginNext: string;
}) {
  const t = await getTranslations("aircraft.eligibility");
  const tp = (await getTranslations("pilot")) as unknown as PilotTranslate;
  const text = t as unknown as (key: string, values?: Record<string, string | number>) => string;

  if (!viewerId) {
    return (
      <div className="grid gap-2 text-sm">
        <p className="text-muted-foreground">{t("logInText")}</p>
        <Button variant="outline" size="sm" className="justify-self-start" asChild>
          <Link href={`/login?next=${encodeURIComponent(loginNext)}`}>{t("logIn")}</Link>
        </Button>
      </div>
    );
  }

  const failures = await getMyEligibility(viewerId, aircraftId, period ?? undefined);
  const blocking = failures.filter((f) => f.blocking);
  const conditions = failures.filter((f) => !f.blocking);

  return (
    <div className="grid gap-2 text-sm">
      {blocking.length === 0 ? (
        <p className="flex items-start gap-2 font-medium text-success">
          <CircleCheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          {period ? t("okForPeriod") : t("ok")}
        </p>
      ) : (
        <>
          <p className="flex items-start gap-2 font-medium text-destructive">
            <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t("notYet")}
          </p>
          <ul className="grid list-disc gap-1 pl-10">
            {blocking.map((f, i) => (
              <li key={`${f.requirement}-${i}`}>{eligibilityText(f, text, tp, typeDesignator)}</li>
            ))}
          </ul>
          <Button variant="link" size="sm" className="justify-self-start px-0" asChild>
            <Link href="/pilot">{t("updateCredentials")}</Link>
          </Button>
        </>
      )}
      {conditions.map((f) => (
        <p key={f.requirement} className="flex items-start gap-2 text-muted-foreground">
          <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          {eligibilityText(f, text, tp, typeDesignator)}
        </p>
      ))}
    </div>
  );
}
