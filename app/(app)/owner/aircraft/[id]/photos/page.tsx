import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ContinueLink } from "@/components/aircraft/continue-link";
import { SectionHeading } from "@/components/aircraft/section-heading";
import { Card, CardContent } from "@/components/ui/card";
import { requireOwnAircraft } from "@/lib/aircraft/owner";
import { getPhotos } from "@/lib/aircraft/queries";
import { PhotoManager } from "./photo-manager";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("aircraft.sections");
  return { title: t("photos") };
}

export default async function PhotosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, aircraft } = await requireOwnAircraft(id, "photos");
  const t = await getTranslations("aircraft");
  const photos = await getPhotos(user.id, id);

  return (
    <div className="grid gap-6">
      <SectionHeading title={t("sections.photos")} text={t("sectionText.photos")} />
      <Card>
        <CardContent>
          <PhotoManager aircraftId={id} photos={photos.map((p) => ({ id: p.id, url: p.url }))} />
        </CardContent>
      </Card>
      {aircraft.status === "draft" && <ContinueLink href={`/owner/aircraft/${id}/documents`} />}
    </div>
  );
}
