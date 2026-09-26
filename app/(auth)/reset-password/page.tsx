import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;
  const valid = Boolean(token) && !error;

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h1" className="text-xl">
          {valid ? "Choose a new password" : "This link didn't work"}
        </CardTitle>
        <CardDescription>
          {valid
            ? "Use at least 8 characters. A short sentence works well."
            : "Reset links expire after an hour and can only be used once."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        {valid ? (
          <ResetPasswordForm token={token!} />
        ) : (
          <Button asChild>
            <Link href="/forgot-password">Send a new link</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
