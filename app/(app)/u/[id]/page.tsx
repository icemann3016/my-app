import { cache } from "react";
import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPinIcon, StarIcon } from "lucide-react";

import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { avatarUrl } from "@/lib/avatar-url";
import { getUser } from "@/lib/auth/session";
import { isDatabaseConfigured } from "@/lib/db";
import { asAnon } from "@/lib/db/rls";
import { profiles, userRoles } from "@/lib/db/schema";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLE_LABELS: Record<string, string> = { pilot: "Pilot", owner: "Aircraft owner" };

const getPublicProfile = cache(async (id: string) => {
  if (!UUID.test(id) || !isDatabaseConfigured()) return null;
  return asAnon(async (tx) => {
    const [profile] = await tx
      .select({
        id: profiles.id,
        displayName: profiles.displayName,
        bio: profiles.bio,
        avatarKey: profiles.avatarKey,
        homeAirportIcao: profiles.homeAirportIcao,
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
    return { profile, roles: roles.map((r) => r.role).filter((r) => r in ROLE_LABELS) };
  });
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const data = await getPublicProfile((await params).id);
  return { title: data?.profile.displayName ?? "Profile not found" };
}

export default async function PublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getPublicProfile(id);
  if (!data) notFound();
  const { profile, roles } = data;
  const viewer = await getUser();
  const memberSince = new Intl.DateTimeFormat("en-GB", {
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
                    {ROLE_LABELS[role]}
                  </Badge>
                ))}
              </div>
            </div>
            {viewer?.id === profile.id && (
              <Button variant="outline" size="sm" className="ml-auto" asChild>
                <Link href="/account">Edit profile</Link>
              </Button>
            )}
          </div>

          <dl className="grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Rating</dt>
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
                  "No ratings yet"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Home airfield</dt>
              <dd className="flex items-center gap-1 font-medium">
                {profile.homeAirportIcao ? (
                  <>
                    <MapPinIcon className="size-4 text-primary" aria-hidden />
                    {profile.homeAirportIcao}
                  </>
                ) : (
                  "Not set"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Member since</dt>
              <dd className="font-medium">{memberSince}</dd>
            </div>
          </dl>

          {profile.bio && (
            <p className="text-sm leading-relaxed whitespace-pre-line">{profile.bio}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
