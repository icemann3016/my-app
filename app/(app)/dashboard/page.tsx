import type { Metadata } from "next";
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
import { requireProfile } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common.nav");
  return { title: t("dashboard") };
}

export default async function DashboardPage() {
  const { userId, profile, roles } = await requireProfile("/dashboard");
  const t = await getTranslations("dashboard");
  const firstName = profile.displayName.split(/\s+/)[0] ?? profile.displayName;
  const profileComplete = Boolean(profile.avatarKey && profile.homeAirportIcao && profile.bio);
  const isPilot = roles.includes("pilot");
  const isOwner = roles.includes("owner");

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title", { name: firstName })}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

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
          done={isPilot}
          labels={{ done: t("done"), todo: t("todo") }}
          icon={PlaneIcon}
          title={t("pilotTitle")}
          text={isPilot ? t("pilotTextOn") : t("pilotTextOff")}
          action={
            !isPilot && (
              <Button size="sm" asChild>
                <Link href="/account#roles">{t("switchOn")}</Link>
              </Button>
            )
          }
        />
        <StepCard
          done={isOwner}
          labels={{ done: t("done"), todo: t("todo") }}
          icon={CalendarCheckIcon}
          title={t("ownerTitle")}
          text={isOwner ? t("ownerTextOn") : t("ownerTextOff")}
          action={
            !isOwner && (
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
