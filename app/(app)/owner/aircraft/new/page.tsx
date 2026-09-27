import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth/session";
import { getUserUnits } from "@/lib/units-server";
import { DetailsForm } from "../_components/listing-forms";
import { createAircraft } from "../actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("owner.new");
  return { title: t("title") };
}

export default async function NewAircraftPage() {
  const { roles } = await requireProfile("/owner/aircraft/new");
  if (!roles.includes("owner")) redirect("/owner/aircraft");
  const t = await getTranslations("owner.new");
  const units = await getUserUnits();

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-10">
      <Button variant="ghost" size="sm" className="-ml-3 justify-self-start" asChild>
        <Link href="/owner/aircraft">
          <ArrowLeftIcon aria-hidden /> {t("back")}
        </Link>
      </Button>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle as="h2">{t("detailsTitle")}</CardTitle>
          <CardDescription>{t("detailsText")}</CardDescription>
        </CardHeader>
        <CardContent>
          <DetailsForm action={createAircraft} values={{}} units={units} create />
        </CardContent>
      </Card>
    </div>
  );
}
