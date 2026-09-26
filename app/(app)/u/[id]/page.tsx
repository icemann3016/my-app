import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPinIcon, StarIcon } from "lucide-react";

import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { avatarUrl } from "@/lib/avatar";
import { getUser } from "@/lib/auth/session";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLE_LABELS: Record<string, string> = { pilot: "Pilot", owner: "Aircraft owner" };

const getPublicProfile = cache(async (id: string) => {
  if (!UUID.test(id) || !getSupabaseEnv()) return null;
  const supabase = await createClient();
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, display_name, bio, avatar_path, home_airport_icao, rating_avg, rating_count, created_at",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", id),
  ]);
  if (!profile) return null;
  return { profile, roles: (roles ?? []).map((r) => r.role).filter((r) => r in ROLE_LABELS) };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const data = await getPublicProfile((await params).id);
  return { title: data?.profile.display_name ?? "Profile not found" };
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
  }).format(new Date(profile.created_at));

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <Card>
        <CardContent className="grid gap-6">
          <div className="flex flex-wrap items-center gap-4">
            <UserAvatar
              name={profile.display_name}
              url={avatarUrl(profile.avatar_path)}
              size={80}
            />
            <div className="grid gap-1">
              <h1 className="text-2xl font-semibold tracking-tight">{profile.display_name}</h1>
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
                {profile.rating_count > 0 && profile.rating_avg !== null ? (
                  <>
                    <StarIcon className="size-4 fill-current text-amber-500" aria-hidden />
                    {profile.rating_avg.toFixed(1)}
                    <span className="font-normal text-muted-foreground">
                      ({profile.rating_count})
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
                {profile.home_airport_icao ? (
                  <>
                    <MapPinIcon className="size-4 text-primary" aria-hidden />
                    {profile.home_airport_icao}
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
