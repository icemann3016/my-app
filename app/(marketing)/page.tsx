import { Suspense } from "react";
import { BadgeCheckIcon, CircleCheckIcon, PlaneIcon, StarIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { DatabaseStatus } from "@/components/dev/database-status";
import { AudienceCards } from "@/components/marketing/audience-cards";
import { ClosingCta } from "@/components/marketing/closing-cta";
import { HomeHero } from "@/components/marketing/home-hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { PhotoStrip } from "@/components/marketing/photo-strip";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
      <HomeHero>
        {deleted && (
          <Alert variant="success" className="max-w-xl">
            <CircleCheckIcon />
            <AlertDescription>{t("accountDeleted")}</AlertDescription>
          </Alert>
        )}
        <Suspense fallback={null}>
          <DatabaseStatus />
        </Suspense>
      </HomeHero>

      <section className="border-b bg-muted/40">
        <ul className="mx-auto grid max-w-6xl gap-4 px-4 py-6 sm:grid-cols-3">
          {trust.map(({ key, icon: Icon }) => (
            <li key={key} className="flex items-center gap-3 text-sm">
              <Icon className="size-5 shrink-0 text-primary" aria-hidden />
              {t(key)}
            </li>
          ))}
        </ul>
      </section>

      <AudienceCards />
      <PhotoStrip />
      <HowItWorks />
      <ClosingCta />
    </>
  );
}
