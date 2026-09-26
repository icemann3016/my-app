import type { Metadata } from "next";
import Link from "next/link";
import { MailCheckIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResendForm } from "./resend-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("checkEmail");
  return { title: t("title") };
}

export default async function CheckEmailPage() {
  const t = await getTranslations("checkEmail");
  return (
    <Card>
      <CardHeader>
        <MailCheckIcon className="mb-2 size-8 text-primary" aria-hidden />
        <CardTitle as="h1" className="text-xl">
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">{t("noEmail")}</p>
          <ResendForm />
        </div>
        <p className="text-center text-sm text-muted-foreground">
          {t("alreadyConfirmed")}{" "}
          <Link
            href="/login"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {t("logIn")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
