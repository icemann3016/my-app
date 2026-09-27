import { cache } from "react";
import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPinIcon, ShieldCheckIcon, StarIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { airportPlace, getAirport } from "@/lib/airports";
import { avatarUrl } from "@/lib/avatar-url";
import { getUser } from "@/lib/auth/session";
import { isDatabaseConfigured } from "@/lib/db";
import { asAnon } from "@/lib/db/rls";
import { profiles, userRoles } from "@/lib/db/schema";
import { intlLocale } from "@/lib/i18n/config";
import { getListedAircraftOf } from "@/lib/aircraft/queries";
import { formatMoney } from "@/lib/aircraft/format";
import { aircraftTitle } from "@/lib/aircraft/catalog";
import { getPilotBadges } from "@/lib/pilot/credentials";
import { credentialLabel, type PilotTranslate } from "@/lib/pilot/labels";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PUBLIC_ROLES = ["pilot", "owner"] as const;
type PublicRole = (typeof PUBLIC_ROLES)[number];
const isPublicRole = (r: string): r is PublicRole =>
  (PUBLIC_ROLES as readonly string[]).includes(r);

const getPublicProfile = cache(async (id: string) => {
  if (!UUID.test(id) || !isDatabaseConfigured()) return null;
  return asAnon(async (tx) => {
    const [profile] = await tx
      .select({
        id: profiles.id,
        displayName: profiles.displayName,
        bio: profiles.bio,
        avatarKey: profiles.avatarKey,
        homeAirportIdent: profiles.homeAirportIdent,
        ratingAvg: profiles.ratingAvg,
        ratingCount: profiles.ratingCount,
        createdAt: profiles.createdAt,
      })
      .from(profiles)
      .where(eq(profiles.id, id));
    if (!profile) return null;
    const roles = await tx
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(eq(userRoles.userId, id));
    return { profile, roles: roles.map((r) => r.role).filter(isPublicRole) };
  });
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const data = await getPublicProfile((await params).id);
  const t = await getTranslations("profile");
  return { title: data?.profile.displayName ?? t("notFound") };
}

export default async function PublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getPublicProfile(id);
  if (!data) notFound();
  const { profile, roles } = data;
  const homeAirport = await getAirport(profile.homeAirportIdent);
  const viewer = await getUser();
  const t = await getTranslations("profile");
  const isPilot = roles.includes("pilot");
  const badges = isPilot ? await getPilotBadges(profile.id) : [];
  const fleet = roles.includes("owner") ? await getListedAircraftOf(profile.id) : [];
  const locale = await getLocale();
  const tp = (await getTranslations("pilot")) as unknown as PilotTranslate;
  const memberSince = new Intl.DateTimeFormat(intlLocale(await getLocale()), {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(profile.createdAt);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <Card>
        <CardContent className="grid gap-6">
          <div className="flex flex-wrap items-center gap-4">
            <UserAvatar name={profile.displayName} url={avatarUrl(profile.avatarKey)} size={80} />
            <div className="grid gap-1">
              <h1 className="text-2xl font-semibold tracking-tight">{profile.displayName}</h1>
              <div className="flex flex-wrap gap-1.5">
                {roles.map((role) => (
                  <Badge key={role} variant="secondary">
                    {t(`roles.${role}`)}
                  </Badge>
                ))}
              </div>
            </div>
            {viewer?.id === profile.id && (
              <Button variant="outline" size="sm" className="ml-auto" asChild>
                <Link href="/account">{t("edit")}</Link>
              </Button>
            )}
          </div>

          <dl className="grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">{t("rating")}</dt>
              <dd className="flex items-center gap-1 font-medium">
                {profile.ratingCount > 0 && profile.ratingAvg !== null ? (
                  <>
                    <StarIcon className="size-4 fill-current text-amber-500" aria-hidden />
                    {profile.ratingAvg.toFixed(1)}
                    <span className="font-normal text-muted-foreground">
                      ({profile.ratingCount})
                    </span>
                  </>
                ) : (
                  t("noRatings")
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("homeAirfield")}</dt>
              <dd className="font-medium">
                {homeAirport ? (
                  <div title={airportPlace(homeAirport)}>
                    <span className="flex items-center gap-1">
                      <MapPinIcon className="size-4 shrink-0 text-primary" aria-hidden />
                      <span className="font-mono whitespace-nowrap">{homeAirport.code}</span>
                    </span>
                    <span className="block truncate text-xs font-normal text-muted-foreground">
                      {homeAirport.name}
                    </span>
                  </div>
                ) : (
                  t("notSet")
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("memberSince")}</dt>
              <dd className="font-medium">{memberSince}</dd>
            </div>
          </dl>

          {isPilot && (
            <section aria-labelledby="verified-credentials" className="grid gap-2">
              <h2 id="verified-credentials" className="text-sm text-muted-foreground">
                {t("verifiedCredentials")}
              </h2>
              {badges.length ? (
                <ul className="flex flex-wrap gap-1.5">
                  {badges.map((b) => {
                    const label = credentialLabel(b, tp);
                    return (
                      <li key={label}>
                        <Badge variant="outline" className="border-success/40 text-sm">
                          <ShieldCheckIcon className="text-success" aria-hidden /> {label}
                        </Badge>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm font-medium">{t("noVerifiedCredentials")}</p>
              )}
            </section>
          )}

          {profile.bio && (
            <p className="text-sm leading-relaxed whitespace-pre-line">{profile.bio}</p>
          )}
        </CardContent>
      </Card>

      {fleet.length > 0 && (
        <section aria-labelledby="fleet" className="mt-6 grid gap-3">
          <h2 id="fleet" className="text-lg font-semibold">
            {t("aircraft")}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {fleet.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/aircraft/${a.id}`}
                  className="flex items-center gap-3 rounded-xl border bg-card p-2 hover:bg-accent/50"
                >
                  <div className="relative aspect-[4/3] w-24 shrink-0 overflow-hidden rounded-md bg-muted">
                    {a.coverUrl && (
                      <Image src={a.coverUrl} alt="" fill sizes="96px" className="object-cover" />
                    )}
                  </div>
                  <div className="grid min-w-0 gap-0.5 text-sm">
                    <span className="truncate font-medium">{aircraftTitle(a)}</span>
                    <span className="text-muted-foreground">
                      <span className="font-mono">{a.registration}</span>
                      {a.homeAirportIdent && <> · {a.homeAirportIdent}</>}
                    </span>
                    {a.pricePerHour !== null && (
                      <span>
                        {t("perHour", { price: formatMoney(a.pricePerHour, a.currency, locale) })}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
