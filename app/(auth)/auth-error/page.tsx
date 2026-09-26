import type { Metadata } from "next";
import Link from "next/link";
import { TriangleAlertIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Link not valid" };

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  return (
    <Card>
      <CardHeader>
        <TriangleAlertIcon className="mb-2 size-8 text-destructive" aria-hidden />
        <CardTitle as="h1" className="text-xl">
          This link didn&apos;t work
        </CardTitle>
        <CardDescription>
          Email links expire after a while and can only be used once. Request a new one below.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {reason && <p className="text-sm text-muted-foreground">Details: {reason}</p>}
        <Button asChild>
          <Link href="/signup/check-email">Resend confirmation email</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/forgot-password">Reset password</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
