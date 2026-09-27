import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getVisibleAircraft } from "@/lib/aircraft/public";
import { getAirport } from "@/lib/airports";
import { requireUser } from "@/lib/auth/session";
import { BookingForm } from "./booking-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("booking.form");
  return { title: t("title") };
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const localDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** Request a booking for a listed aircraft (BKG-1). */
export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const user = await requireUser(`/aircraft/${id}/book`);
  const row = await getVisibleAircraft(user.id, id);
  if (!row || row.aircraft.status !== "listed" || row.aircraft.pricePerHour === null) notFound();
  const a = row.aircraft;
  if (a.ownerId === user.id) redirect(`/aircraft/${id}`);
  const t = await getTranslations("booking.form");
  const base = await getAirport(a.homeAirportIdent);
  const from = one(query.from);
  const to = one(query.to);

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-6 px-4 py-8">
      <Button variant="ghost" size="sm" className="-ml-3 justify-self-start" asChild>
        <Link href={`/aircraft/${id}`}>
          <ArrowLeftIcon aria-hidden /> {t("back")}
        </Link>
      </Button>
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">
          {a.manufacturer} {a.model} · <span className="font-mono">{a.registration}</span>
        </p>
      </div>
      <Card>
        <CardContent>
          <BookingForm
            aircraft={{
              id: a.id,
              seats: a.seats,
              pricePerHour: a.pricePerHour!,
              weekendPricePerHour: a.weekendPricePerHour,
              minHoursPerDay: a.minHoursPerDay,
              priceBasis: a.priceBasis,
              fuelBurnLph: a.fuelBurnLph,
              currency: a.currency,
            }}
            base={
              base
                ? {
                    ident: base.ident,
                    code: base.code,
                    iataCode: base.iataCode,
                    name: base.name,
                    municipality: base.municipality,
                    country: base.country,
                  }
                : null
            }
            initial={{
              from: from && localDateTime.test(from) ? from : undefined,
              to: to && localDateTime.test(to) ? to : undefined,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
