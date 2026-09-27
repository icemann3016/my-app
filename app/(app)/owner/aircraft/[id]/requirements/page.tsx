import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { SectionHeading } from "@/components/aircraft/section-heading";
import { Card, CardContent } from "@/components/ui/card";
import { requireOwnAircraft } from "@/lib/aircraft/owner";
import { getRequirements, requirementsFormValues } from "@/lib/aircraft/requirements";
import { RequirementsForm } from "./requirements-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("aircraft.sections");
  return { title: t("requirements") };
}

export default async function RequirementsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, aircraft } = await requireOwnAircraft(id, "requirements");
  const t = await getTranslations("aircraft");
  const requirements = await getRequirements(user.id, id);

  return (
    <div className="grid gap-6">
      <SectionHeading title={t("sections.requirements")} text={t("sectionText.requirements")} />
      <Card>
        <CardContent>
          <RequirementsForm
            aircraftId={id}
            values={requirementsFormValues(requirements)}
            isDraft={aircraft.status === "draft"}
          />
        </CardContent>
      </Card>
    </div>
  );
}
