import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { SectionHeading } from "@/components/aircraft/section-heading";
import { Card, CardContent } from "@/components/ui/card";
import { aircraftFormValues } from "@/lib/aircraft/form-values";
import { requireOwnAircraft } from "@/lib/aircraft/owner";
import { getUnits } from "@/lib/aircraft/queries";
import { getAirport } from "@/lib/airports";
import { BaseForm } from "../../base-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("aircraft.sections");
  return { title: t("base") };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, aircraft } = await requireOwnAircraft(id, "base");
  const t = await getTranslations("aircraft");
  const values = aircraftFormValues(aircraft, await getUnits(user.id));
  const homeAirport = await getAirport(aircraft.homeAirportIdent);
  return (
    <div className="grid gap-6">
      <SectionHeading title={t("sections.base")} text={t("sectionText.base")} />
      <Card>
        <CardContent>
          <BaseForm
            values={values}
            homeAirport={homeAirport}
            isDraft={aircraft.status === "draft"}
          />
        </CardContent>
      </Card>
    </div>
  );
}
