import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { OwnerRoleCard } from "@/components/aircraft/owner-role-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getUnits } from "@/lib/aircraft/queries";
import { requireProfile } from "@/lib/auth/session";
import { DetailsForm } from "../details-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("aircraft.new");
  return { title: t("title") };
}

/** Step 1 of listing an aircraft; the draft is saved when this form is sent. */
export default async function NewAircraftPage() {
  const { userId, roles } = await requireProfile("/owner/aircraft/new");
  const t = await getTranslations("aircraft");

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-10">
      <Button variant="ghost" size="sm" className="-ml-3 justify-self-start" asChild>
        <Link href="/owner/aircraft">
          <ArrowLeftIcon aria-hidden /> {t("edit.back")}
        </Link>
      </Button>
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("new.title")}</h1>
        <p className="text-muted-foreground">{t("new.description")}</p>
      </div>
      {roles.includes("owner") ? (
        <Card>
          <CardContent>
            <DetailsForm units={await getUnits(userId)} isDraft />
          </CardContent>
        </Card>
      ) : (
        <OwnerRoleCard />
      )}
    </div>
  );
}
