import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarCheckIcon,
  CircleCheckIcon,
  CircleIcon,
  PlaneIcon,
  UserRoundIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { userId, profile, roles } = await requireProfile("/dashboard");
  const firstName = profile.display_name.split(/\s+/)[0];
  const profileComplete = Boolean(profile.avatar_path && profile.home_airport_icao && profile.bio);
  const isPilot = roles.includes("pilot");
  const isOwner = roles.includes("owner");

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome, {firstName}</h1>
        <p className="text-muted-foreground">Here&apos;s what to do next.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StepCard
          done={profileComplete}
          icon={UserRoundIcon}
          title="Complete your profile"
          text="Add a photo, your home airfield and a few words about your flying."
          action={
            <Button size="sm" variant={profileComplete ? "outline" : "default"} asChild>
              <Link href="/account">{profileComplete ? "Edit profile" : "Complete profile"}</Link>
            </Button>
          }
        />
        <StepCard
          done={isPilot}
          icon={PlaneIcon}
          title="Fly as a pilot"
          text={
            isPilot
              ? "Next: add your licence, ratings and medical. Coming soon."
              : "Switch on the pilot role to rent aircraft."
          }
          action={
            !isPilot && (
              <Button size="sm" asChild>
                <Link href="/account#roles">Switch on</Link>
              </Button>
            )
          }
        />
        <StepCard
          done={isOwner}
          icon={CalendarCheckIcon}
          title="List your aircraft"
          text={
            isOwner
              ? "Next: create your first listing. Coming soon."
              : "Own an aircraft? Switch on the owner role to rent it out."
          }
          action={
            !isOwner && (
              <Button size="sm" variant="outline" asChild>
                <Link href="/account#roles">Switch on</Link>
              </Button>
            )
          }
        />
      </div>

      <p className="text-sm text-muted-foreground">
        Your public profile:{" "}
        <Link href={`/u/${userId}`} className="text-foreground underline underline-offset-4">
          see what others see
        </Link>
      </p>
    </div>
  );
}

function StepCard({
  done,
  icon: Icon,
  title,
  text,
  action,
}: {
  done: boolean;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="gap-3">
      <CardHeader>
        <div className="flex items-center justify-between">
          <Icon className="size-5 text-primary" />
          {done ? (
            <CircleCheckIcon className="size-5 text-success" aria-label="Done" />
          ) : (
            <CircleIcon className="size-5 text-muted-foreground" aria-label="To do" />
          )}
        </div>
        <CardTitle as="h2" className="pt-2">
          {title}
        </CardTitle>
        <CardDescription>{text}</CardDescription>
      </CardHeader>
      {action && <CardContent className="mt-auto">{action}</CardContent>}
    </Card>
  );
}
