import { and, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { DownloadIcon, ExternalLinkIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAirport } from "@/lib/airports";
import { avatarUrl } from "@/lib/avatar-url";
import { requireProfile } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { asUser } from "@/lib/db/rls";
import { accounts, userSettings } from "@/lib/db/schema";
import { AvatarUpload } from "./avatar-upload";
import { DeleteAccount } from "./delete-account";
import { PreferencesForm } from "./preferences-form";
import { ProfileForm } from "./profile-form";
import { RolesForm } from "./roles-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account");
  return { title: t("title") };
}

export default async function AccountPage() {
  const { userId, email, profile, roles } = await requireProfile("/account");
  const t = await getTranslations("account");

  const [settings] = await asUser(userId, (tx) =>
    tx.select().from(userSettings).where(eq(userSettings.userId, userId)),
  );
  // Accounts (login methods) are private auth data: read with the owner connection, own rows only.
  const [credential] = await getDb()
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, "credential")))
    .limit(1);
  const hasPassword = Boolean(credential);
  const homeAirport = await getAirport(profile.homeAirportIdent);

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{email}</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/u/${userId}`}>
            {t("viewPublicProfile")} <ExternalLinkIcon />
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle as="h2">{t("profile.title")}</CardTitle>
          <CardDescription>{t("profile.description")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <AvatarUpload name={profile.displayName} url={avatarUrl(profile.avatarKey)} />
          <ProfileForm
            displayName={profile.displayName}
            homeAirport={homeAirport}
            bio={profile.bio ?? ""}
          />
        </CardContent>
      </Card>

      <Card id="roles">
        <CardHeader>
          <CardTitle as="h2">{t("roles.title")}</CardTitle>
          <CardDescription>{t("roles.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <RolesForm roles={roles} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">{t("preferences.title")}</CardTitle>
          <CardDescription>{t("preferences.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <PreferencesForm locale={settings?.locale ?? "en"} units={settings?.units ?? "metric"} />
        </CardContent>
      </Card>

      {hasPassword && (
        <Card>
          <CardHeader>
            <CardTitle as="h2">{t("security.title")}</CardTitle>
            <CardDescription>{t("security.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link href="/account/password">{t("security.changePassword")}</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle as="h2">{t("data.title")}</CardTitle>
          <CardDescription>{t("data.description")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="outline" asChild>
            <a href="/api/account/export" download>
              <DownloadIcon /> {t("data.download")}
            </a>
          </Button>
          <DeleteAccount hasPassword={hasPassword} />
        </CardContent>
      </Card>
    </div>
  );
}
