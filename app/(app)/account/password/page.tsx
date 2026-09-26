import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { PasswordForm } from "./password-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("password");
  return { title: t("title") };
}

export default async function PasswordPage() {
  await requireUser("/account/password");
  const t = await getTranslations("password");
  return (
    <div className="mx-auto w-full max-w-md px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle as="h1" className="text-xl">
            {t("title")}
          </CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <PasswordForm />
          <p className="text-center text-sm">
            <Link
              href="/account"
              className="text-muted-foreground underline-offset-4 hover:underline"
            >
              {t("back")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
