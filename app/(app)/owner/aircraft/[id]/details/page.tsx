import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { SectionHeading } from "@/components/aircraft/section-heading";
import { Card, CardContent } from "@/components/ui/card";
import { aircraftFormValues } from "@/lib/aircraft/form-values";
import { requireOwnAircraft } from "@/lib/aircraft/owner";
import { getUnits } from "@/lib/aircraft/queries";
import { DetailsForm } from "../../details-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("aircraft.sections");
  return { title: t("details") };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, aircraft } = await requireOwnAircraft(id, "details");
  const t = await getTranslations("aircraft");
  const units = await getUnits(user.id);
  const values = aircraftFormValues(aircraft, units);

  return (
    <div className="grid gap-6">
      <SectionHeading title={t("sections.details")} text={t("sectionText.details")} />
      <Card>
        <CardContent>
          <DetailsForm values={values} units={units} isDraft={aircraft.status === "draft"} />
        </CardContent>
      </Card>
    </div>
  );
}
