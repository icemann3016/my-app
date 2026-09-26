import type { Metadata } from "next";
import Link from "next/link";
import { MailCheckIcon } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResendForm } from "./resend-form";

export const metadata: Metadata = { title: "Check your email" };

export default function CheckEmailPage() {
  return (
    <Card>
      <CardHeader>
        <MailCheckIcon className="mb-2 size-8 text-primary" aria-hidden />
        <CardTitle as="h1" className="text-xl">
          Check your email
        </CardTitle>
        <CardDescription>
          We&apos;ve sent you a link to confirm your address. Open it on this device to finish
          creating your account.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">
            No email after a few minutes? Check your spam folder, or send it again:
          </p>
          <ResendForm />
        </div>
        <p className="text-center text-sm text-muted-foreground">
          Already confirmed?{" "}
          <Link
            href="/login"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Log in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
