import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { safeNextPath } from "@/lib/auth/redirect";
import { getUser } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string; error?: string }>;
}) {
  const { next, reset, error } = await searchParams;
  const nextPath = safeNextPath(next);
  if (await getUser()) redirect(nextPath);

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h1" className="text-xl">
          Log in
        </CardTitle>
        <CardDescription>Welcome back. Log in to rent or list aircraft.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        {reset && (
          <Alert variant="success">
            <AlertDescription>Your password was changed. Log in with the new one.</AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              That link has expired or was already used. Log in, or request a new link.
            </AlertDescription>
          </Alert>
        )}
        <LoginForm next={nextPath} />
        <p className="text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link
            href={next ? `/signup?next=${encodeURIComponent(nextPath)}` : "/signup"}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
