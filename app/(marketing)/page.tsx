import { Suspense } from "react";
import Link from "next/link";
import {
  BadgeCheckIcon,
  Building2Icon,
  CalendarCheckIcon,
  PlaneIcon,
  StarIcon,
  WrenchIcon,
} from "lucide-react";

import { SupabaseStatus } from "@/components/dev/supabase-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const audiences = [
  {
    icon: PlaneIcon,
    title: "Pilots",
    text: "Search aircraft near you by dates, see specs, price per hour and availability, and send a booking request.",
  },
  {
    icon: CalendarCheckIcon,
    title: "Owners",
    text: "List your aircraft, manage its calendar and decide who flies it with a minimum pilot rating and experience rules.",
  },
  {
    icon: WrenchIcon,
    title: "Technicians",
    text: "Offer 50 h and 100 h checks and other maintenance to owners nearby.",
    soon: true,
  },
  {
    icon: Building2Icon,
    title: "Airports",
    text: "Take PPR, apron parking, hangar, fuel and customs requests online.",
    soon: true,
  },
];

const trust = [
  { icon: BadgeCheckIcon, text: "Verified licences, ratings and medicals" },
  { icon: StarIcon, text: "Two-way ratings after every flight" },
  { icon: PlaneIcon, text: "Built for EASA rules and European airfields" },
];

export default function HomePage() {
  return (
    <>
      <section className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 pt-16 pb-12 sm:pt-24">
        <Suspense fallback={null}>
          <SupabaseStatus />
        </Suspense>
        <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
          Early preview · Europe
        </span>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          Rent a plane. Fly more.
        </h1>
        <p className="max-w-2xl text-lg text-pretty text-muted-foreground">
          Find verified aircraft to rent near you and book with owners who can see your ratings.
          Hiring technicians and requesting airport services will follow, all in one place.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button size="lg" asChild>
            <Link href="/search">Find an aircraft</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/owner/aircraft">List your aircraft</Link>
          </Button>
        </div>
      </section>

      <section aria-labelledby="audiences" className="mx-auto max-w-6xl px-4 pb-12">
        <h2 id="audiences" className="sr-only">
          Who it&apos;s for
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {audiences.map(({ icon: Icon, title, text, soon }) => (
            <Card key={title} className="gap-3">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Icon className="size-5 text-primary" aria-hidden />
                  {soon && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      Coming later
                    </span>
                  )}
                </div>
                <CardTitle className="pt-2">{title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{text}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-t bg-muted/40">
        <ul className="mx-auto grid max-w-6xl gap-4 px-4 py-8 sm:grid-cols-3">
          {trust.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-sm">
              <Icon className="size-5 shrink-0 text-primary" aria-hidden />
              {text}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
