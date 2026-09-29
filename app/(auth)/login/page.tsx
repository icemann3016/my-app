import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { SocialSignIn } from "@/components/auth/social-sign-in";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loginErrorKey } from "@/lib/auth/errors";
import { safeNextPath } from "@/lib/auth/redirect";
import { getUser } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("login");
  return { title: t("title") };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string; error?: string }>;
}) {
  const { next, reset, error } = await searchParams;
  const nextPath = safeNextPath(next);
  if (await getUser()) redirect(nextPath);
  const t = await getTranslations("login");
  const errorKey = loginErrorKey(error);

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h1" className="text-xl">
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        {reset && (
          <Alert variant="success">
            <AlertDescription>{t("passwordChanged")}</AlertDescription>
          </Alert>
        )}
        {errorKey && (
          <Alert variant="destructive">
            <AlertDescription>
              <p>{t(errorKey)}</p>
              {errorKey === "oauthFailed" && (
                <p className="text-xs opacity-80">{t("errorCode", { code: error! })}</p>
              )}
            </AlertDescription>
          </Alert>
        )}
        <SocialSignIn next={nextPath} />
        <LoginForm next={nextPath} />
        <p className="text-center text-sm text-muted-foreground">
          {t("newHere")}{" "}
          <Link
            href={next ? `/signup?next=${encodeURIComponent(nextPath)}` : "/signup"}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {t("createAccount")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
