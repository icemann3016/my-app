import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Change password" };

export default async function PasswordPage() {
  await requireUser("/account/password");
  return (
    <div className="mx-auto w-full max-w-md px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle as="h1" className="text-xl">
            Change password
          </CardTitle>
          <CardDescription>
            Use at least 8 characters. You&apos;ll stay logged in here and be logged out elsewhere.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <PasswordForm />
          <p className="text-center text-sm">
            <Link
              href="/account"
              className="text-muted-foreground underline-offset-4 hover:underline"
            >
              Back to account
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
