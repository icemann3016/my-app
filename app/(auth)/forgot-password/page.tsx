import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h1" className="text-xl">
          Reset your password
        </CardTitle>
        <CardDescription>
          Enter your email and we&apos;ll send you a link to choose a new password.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <ForgotPasswordForm />
        <p className="text-center text-sm text-muted-foreground">
          <Link
            href="/login"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Back to log in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
