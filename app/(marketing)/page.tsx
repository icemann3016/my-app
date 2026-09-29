import { Suspense } from "react";
import Link from "next/link";
import {
  BadgeCheckIcon,
  Building2Icon,
  CalendarCheckIcon,
  CircleCheckIcon,
  PlaneIcon,
  StarIcon,
  WrenchIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { DatabaseStatus } from "@/components/dev/database-status";
import { ClosingCta } from "@/components/marketing/closing-cta";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { SkyScene } from "@/components/marketing/sky-scene";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const audiences = [
  { key: "pilots", icon: PlaneIcon, soon: false },
  { key: "owners", icon: CalendarCheckIcon, soon: false },
  { key: "technicians", icon: WrenchIcon, soon: true },
  { key: "airports", icon: Building2Icon, soon: true },
] as const;

const trust = [
  { key: "trustLicences", icon: BadgeCheckIcon },
  { key: "trustRatings", icon: StarIcon },
  { key: "trustEasa", icon: PlaneIcon },
] as const;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  const { deleted } = await searchParams;
  const t = await getTranslations("home");

  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-12 pb-12 sm:pt-20 lg:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col items-start gap-6">
          {deleted && (
            <Alert variant="success" className="max-w-xl">
              <CircleCheckIcon />
              <AlertDescription>{t("accountDeleted")}</AlertDescription>
            </Alert>
          )}
          <Suspense fallback={null}>
            <DatabaseStatus />
          </Suspense>
          <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
            {t("badge")}
          </span>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            {t("title")}
          </h1>
          <p className="max-w-2xl text-lg text-pretty text-muted-foreground">{t("subtitle")}</p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link href="/search">{t("findAircraft")}</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/owner/aircraft">{t("listAircraft")}</Link>
            </Button>
          </div>
        </div>
        <div className="aspect-[8/5] overflow-hidden rounded-2xl border shadow-xl ring-1 ring-black/5">
          <SkyScene />
        </div>
      </section>

      <section aria-labelledby="audiences" className="mx-auto max-w-6xl px-4 pb-12">
        <h2 id="audiences" className="sr-only">
          {t("audiencesHeading")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {audiences.map(({ key, icon: Icon, soon }) => (
            <Card
              key={key}
              className="gap-3 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                    <Icon className="size-5 text-primary" aria-hidden />
                  </span>
                  {soon && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {t("comingLater")}
                    </span>
                  )}
                </div>
                <CardTitle as="h3" className="pt-2">
                  {t(`${key}.title`)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{t(`${key}.text`)}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <HowItWorks />

      <section className="border-y bg-muted/40">
        <ul className="mx-auto grid max-w-6xl gap-4 px-4 py-8 sm:grid-cols-3">
          {trust.map(({ key, icon: Icon }) => (
            <li key={key} className="flex items-center gap-3 text-sm">
              <Icon className="size-5 shrink-0 text-primary" aria-hidden />
              {t(key)}
            </li>
          ))}
        </ul>
      </section>

      <ClosingCta />
    </>
  );
}
