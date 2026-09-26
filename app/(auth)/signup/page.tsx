import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { GoogleSignIn } from "@/components/auth/google-sign-in";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getUser } from "@/lib/auth/session";
import { SignupForm } from "./signup-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("signup");
  return { title: t("title") };
}

export default async function SignupPage() {
  if (await getUser()) redirect("/dashboard");
  const t = await getTranslations("signup");

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h1" className="text-xl">
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <GoogleSignIn showTerms />
        <SignupForm />
        <p className="text-center text-sm text-muted-foreground">
          {t("alreadyHaveAccount")}{" "}
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
