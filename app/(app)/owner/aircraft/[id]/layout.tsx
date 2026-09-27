import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ExternalLinkIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { AircraftStatusBadge } from "@/components/aircraft/aircraft-status-badge";
import { Button } from "@/components/ui/button";
import { aircraftTitle } from "@/lib/aircraft/catalog";
import { sectionStates } from "@/lib/aircraft/editor";
import { getAircraftForOwner } from "@/lib/aircraft/queries";
import { requireProfile } from "@/lib/auth/session";
import { SectionNav } from "../_components/section-nav";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Aircraft editor: header with status, and the section navigation. */
export default async function AircraftEditorLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId } = await requireProfile(`/owner/aircraft/${id}`);
  if (!UUID.test(id)) notFound();
  const data = await getAircraftForOwner(userId, id);
  if (!data) notFound();
  const { aircraft: a } = data;
  const t = await getTranslations("owner.editor");
  const ts = await getTranslations("aircraft.statuses");

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8">
      <Button variant="ghost" size="sm" className="-ml-3 justify-self-start" asChild>
        <Link href="/owner/aircraft">
          <ArrowLeftIcon aria-hidden /> {t("back")}
        </Link>
      </Button>
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{aircraftTitle(a)}</h1>
            <AircraftStatusBadge status={a.status} label={ts(a.status)} />
          </div>
          <p className="font-mono text-sm text-muted-foreground">{a.registration}</p>
        </div>
        <Button variant="outline" size="sm" className="ml-auto" asChild>
          <Link href={`/aircraft/${a.id}`}>
            {a.status === "listed" ? t("viewListing") : t("preview")}{" "}
            <ExternalLinkIcon aria-hidden />
          </Link>
        </Button>
      </div>
      <div className="grid gap-6 md:grid-cols-[13rem_1fr]">
        <SectionNav aircraftId={a.id} states={sectionStates(data.problems, data.documents)} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
