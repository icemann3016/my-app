import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarCheckIcon,
  CircleCheckIcon,
  CircleIcon,
  PlaneIcon,
  TriangleAlertIcon,
  UserRoundIcon,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getOwnerAircraft } from "@/lib/aircraft/queries";
import { requireProfile } from "@/lib/auth/session";
import { intlLocale } from "@/lib/i18n/config";
import { credentialItems, getPilotCredentials } from "@/lib/pilot/credentials";
import { credentialLabel, type PilotTranslate } from "@/lib/pilot/labels";
import { pilotSummary } from "@/lib/pilot/summary";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common.nav");
  return { title: t("dashboard") };
}

export default async function DashboardPage() {
  const { userId, profile, roles } = await requireProfile("/dashboard");
  const t = await getTranslations("dashboard");
  const firstName = profile.displayName.split(/\s+/)[0] ?? profile.displayName;
  const profileComplete = Boolean(profile.avatarKey && profile.homeAirportIdent && profile.bio);
  const isPilot = roles.includes("pilot");
  const isOwner = roles.includes("owner");

  const creds = isPilot ? await getPilotCredentials(userId) : null;
  const ownAircraft = isOwner ? await getOwnerAircraft(userId) : [];
  const listedCount = ownAircraft.filter((a) => a.status === "listed").length;
  const summary = creds ? pilotSummary(credentialItems(creds)) : null;
  const pilotText = !summary
    ? t("pilotTextOff")
    : summary.verified
      ? t("pilotTextVerified")
      : summary.rejected
        ? t("pilotTextRejected")
        : summary.pending
          ? t("pilotTextPending")
          : t("pilotTextMissing");

  // Items that expire soon or have expired, e.g. "Class 2 medical expires on 15 Oct 2026."
  const tp = (await getTranslations("pilot")) as unknown as PilotTranslate;
  const dateFormat = new Intl.DateTimeFormat(intlLocale(await getLocale()), {
    dateStyle: "medium",
    timeZone: "UTC",
  });
  const warnings = summary
    ? [...summary.expired, ...summary.expiring].map((item) => {
        const values = {
          item: credentialLabel(item.ref!, tp),
          date: dateFormat.format(new Date(`${item.expiresOn}T00:00:00Z`)),
        };
        return summary.expired.includes(item)
          ? t("credentialExpired", values)
          : t("credentialExpiring", values);
      })
    : [];

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title", { name: firstName })}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      {warnings.length > 0 && (
        <Alert>
          <TriangleAlertIcon className="text-warning" />
          <AlertTitle>{t("expiryTitle")}</AlertTitle>
          <AlertDescription>
            {warnings.map((w) => (
              <p key={w}>{w}</p>
            ))}
            <Link href="/pilot" className="text-foreground underline underline-offset-4">
              {t("manageCredentials")}
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <StepCard
          done={profileComplete}
          labels={{ done: t("done"), todo: t("todo") }}
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
          labels={{ done: t("done"), todo: t("todo") }}
          icon={PlaneIcon}
          title={t("pilotTitle")}
          text={pilotText}
          action={
            isPilot ? (
              <Button size="sm" variant={summary?.verified ? "outline" : "default"} asChild>
                <Link href="/pilot">
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
          done={listedCount > 0}
          labels={{ done: t("done"), todo: t("todo") }}
          icon={CalendarCheckIcon}
          title={t("ownerTitle")}
          text={
            !isOwner
              ? t("ownerTextOff")
              : ownAircraft.length === 0
                ? t("ownerTextNone")
                : t("ownerTextSome", { count: ownAircraft.length, listed: listedCount })
          }
          action={
            isOwner ? (
              <Button size="sm" variant={listedCount > 0 ? "outline" : "default"} asChild>
                <Link href={ownAircraft.length ? "/owner/aircraft" : "/owner/aircraft/new"}>
                  {ownAircraft.length ? t("myAircraft") : t("addAircraft")}
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

      <p className="text-sm text-muted-foreground">
        {t("publicProfile")}{" "}
        <Link href={`/u/${userId}`} className="text-foreground underline underline-offset-4">
          {t("seeWhatOthersSee")}
        </Link>
      </p>
    </div>
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
        <CardTitle as="h2" className="pt-2">
          {title}
        </CardTitle>
        <CardDescription>{text}</CardDescription>
      </CardHeader>
      {action && <CardContent className="mt-auto">{action}</CardContent>}
    </Card>
  );
}
