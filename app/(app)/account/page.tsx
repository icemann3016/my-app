import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLinkIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { avatarUrl } from "@/lib/avatar";
import { requireProfile } from "@/lib/auth/session";
import { AvatarUpload } from "./avatar-upload";
import { ProfileForm } from "./profile-form";
import { RolesForm } from "./roles-form";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const { userId, email, profile, roles } = await requireProfile("/account");

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
          <p className="text-sm text-muted-foreground">{email}</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/u/${userId}`}>
            View public profile <ExternalLinkIcon />
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Profile</CardTitle>
          <CardDescription>
            This is what owners and pilots see on your public profile.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <AvatarUpload
            userId={userId}
            name={profile.display_name}
            url={avatarUrl(profile.avatar_path)}
          />
          <ProfileForm
            displayName={profile.display_name}
            homeAirport={profile.home_airport_icao ?? ""}
            bio={profile.bio ?? ""}
          />
        </CardContent>
      </Card>

      <Card id="roles">
        <CardHeader>
          <CardTitle as="h2">How you&apos;ll use the app</CardTitle>
          <CardDescription>
            Switch on what applies to you. You can change this any time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RolesForm roles={roles} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Security</CardTitle>
          <CardDescription>Change the password you use to log in.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <Link href="/account/password">Change password</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
