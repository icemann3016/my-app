import Link from "next/link";
import {
  CalendarCheckIcon,
  CircleCheckIcon,
  CircleIcon,
  PlaneIcon,
  UserRoundIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PilotSummary } from "@/lib/pilot/summary";

/** Getting started: profile, pilot credentials, first aircraft. Shown until all three are done. */
export async function SetupSteps({
  profileComplete,
  isPilot,
  isOwner,
  summary,
  aircraftCount,
  listed,
}: {
  profileComplete: boolean;
  isPilot: boolean;
  isOwner: boolean;
  summary: PilotSummary | null;
  aircraftCount: number;
  listed: number;
}) {
  const t = await getTranslations("dashboard");
  const ownerText = !isOwner
    ? t("ownerTextOff")
    : listed
      ? t("ownerTextListed", { count: listed })
      : aircraftCount
        ? t("ownerTextDraft")
        : t("ownerTextOn");
  const pilotText = !summary
    ? t("pilotTextOff")
    : summary.verified
      ? t("pilotTextVerified")
      : summary.rejected
        ? t("pilotTextRejected")
        : summary.pending
          ? t("pilotTextPending")
          : t("pilotTextMissing");
  const labels = { done: t("done"), todo: t("notDone") };
  return (
    <section aria-labelledby="setup" className="grid gap-3">
      <h2 id="setup" className="text-lg font-semibold">
        {t("setupTitle")}
      </h2>
      <div className="grid gap-4 md:grid-cols-3">
        <StepCard
          done={profileComplete}
          labels={labels}
          icon={UserRoundIcon}
          title={t("profileTitle")}
          text={t("profileText")}
          action={
            <Button size="sm" variant={profileComplete ? "outline" : "default"} asChild>
              <Link href="/account">
                {profileComplete ? t("profileEdit") : t("profileComplete")}
              </Link>
            </Button>
          }
        />
        <StepCard
          done={Boolean(summary?.verified)}
          labels={labels}
          icon={PlaneIcon}
          title={t("pilotTitle")}
          text={pilotText}
          action={
            isPilot ? (
              <Button size="sm" variant={summary?.verified ? "outline" : "default"} asChild>
                <Link href="/account/credentials">
                  {summary?.verified || summary?.pending
                    ? t("manageCredentials")
                    : t("addCredentials")}
                </Link>
              </Button>
            ) : (
              <Button size="sm" asChild>
                <Link href="/account#roles">{t("switchOn")}</Link>
              </Button>
            )
          }
        />
        <StepCard
          done={listed > 0}
          labels={labels}
          icon={CalendarCheckIcon}
          title={t("ownerTitle")}
          text={ownerText}
          action={
            isOwner ? (
              <Button size="sm" variant={listed ? "outline" : "default"} asChild>
                <Link href={aircraftCount ? "/owner/aircraft" : "/owner/aircraft/new"}>
                  {aircraftCount ? t("myAircraft") : t("addAircraft")}
                </Link>
              </Button>
            ) : (
              <Button size="sm" variant="outline" asChild>
                <Link href="/account#roles">{t("switchOn")}</Link>
              </Button>
            )
          }
        />
      </div>
    </section>
  );
}

function StepCard({
  done,
  labels,
  icon: Icon,
  title,
  text,
  action,
}: {
  done: boolean;
  labels: { done: string; todo: string };
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="gap-3">
      <CardHeader>
        <div className="flex items-center justify-between">
          <Icon className="size-5 text-primary" />
          {done ? (
            <CircleCheckIcon className="size-5 text-success" aria-label={labels.done} />
          ) : (
            <CircleIcon className="size-5 text-muted-foreground" aria-label={labels.todo} />
          )}
        </div>
        <CardTitle as="h3" className="pt-2">
          {title}
        </CardTitle>
        <CardDescription>{text}</CardDescription>
      </CardHeader>
      {action && <CardContent className="mt-auto">{action}</CardContent>}
    </Card>
  );
}
