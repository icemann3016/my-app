import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResetPasswordForm } from "./reset-password-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("resetPassword");
  return { title: t("title") };
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;
  const valid = Boolean(token) && !error;
  const t = await getTranslations("resetPassword");

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h1" className="text-xl">
          {valid ? t("title") : t("invalidTitle")}
        </CardTitle>
        <CardDescription>{valid ? t("description") : t("invalidDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        {valid ? (
          <ResetPasswordForm token={token!} />
        ) : (
          <Button asChild>
            <Link href="/forgot-password">{t("sendNewLink")}</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
