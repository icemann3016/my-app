import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { SectionHeading } from "@/components/aircraft/section-heading";
import { Card, CardContent } from "@/components/ui/card";
import { aircraftFormValues } from "@/lib/aircraft/form-values";
import { requireOwnAircraft } from "@/lib/aircraft/owner";
import { getUnits } from "@/lib/aircraft/queries";
import { PricingForm } from "../../pricing-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("aircraft.sections");
  return { title: t("pricing") };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, aircraft } = await requireOwnAircraft(id, "pricing");
  const t = await getTranslations("aircraft");
  const values = aircraftFormValues(aircraft, await getUnits(user.id));

  return (
    <div className="grid gap-6">
      <SectionHeading title={t("sections.pricing")} text={t("sectionText.pricing")} />
      <Card>
        <CardContent>
          <PricingForm values={values} isDraft={aircraft.status === "draft"} />
        </CardContent>
      </Card>
    </div>
  );
}
