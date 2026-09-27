import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAirport } from "@/lib/airports";
import { DOCUMENT_KINDS, isSection, type Section } from "@/lib/aircraft/catalog";
import { getAircraftForOwner, type OwnerAircraft } from "@/lib/aircraft/queries";
import { requireProfile } from "@/lib/auth/session";
import { intlLocale } from "@/lib/i18n/config";
import { expiryState } from "@/lib/pilot/validity";
import { massFromKg, type Units, volumeFromLitres } from "@/lib/units";
import { getUserUnits } from "@/lib/units-server";
import {
  AircraftDocumentCard,
  type DocumentRow,
  ReferenceFiles,
} from "../../_components/documents-section";
import { BaseForm, DetailsForm, EquipmentForm, PricingForm } from "../../_components/listing-forms";
import { PhotosManager } from "../../_components/photos-manager";
import { RequirementsForm } from "../../_components/requirements-form";
import {
  addAircraftFile,
  saveAircraftDocument,
  saveRequirements,
  saveSection,
} from "../../actions";

type Params = Promise<{ id: string; section: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { section } = await params;
  if (!isSection(section)) return {};
  const t = await getTranslations("owner.sections");
  return { title: t(section) };
}

const str = (v: number | string | null | undefined) =>
  v === null || v === undefined ? "" : String(v);
const on = (v: boolean) => (v ? "on" : "");

function detailsValues(a: OwnerAircraft["aircraft"], units: Units) {
  return {
    registration: a.registration,
    manufacturer: str(a.manufacturer),
    model: str(a.model),
    icaoType: str(a.icaoType),
    year: str(a.year),
    category: a.category,
    seats: str(a.seats),
    engine: str(a.engine),
    fuelType: str(a.fuelType),
    fuelBurn: a.fuelBurnLph === null ? "" : String(volumeFromLitres(a.fuelBurnLph, units).value),
    cruiseKt: str(a.cruiseKt),
    usefulLoad: a.usefulLoadKg === null ? "" : String(massFromKg(a.usefulLoadKg, units).value),
    enduranceH: str(a.enduranceH),
    oilUnit: a.oilUnit,
  };
}

export default async function AircraftSectionPage({ params }: { params: Params }) {
  const { id, section } = await params;
  if (!isSection(section)) notFound();
  const { userId } = await requireProfile(`/owner/aircraft/${id}/${section}`);
  const data = await getAircraftForOwner(userId, id);
  if (!data) notFound();
  const t = await getTranslations("owner.sections");
  const td = await getTranslations("owner.sectionText");

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">{t(section)}</CardTitle>
        <CardDescription>{td(section)}</CardDescription>
      </CardHeader>
      <CardContent>
        <SectionBody section={section} data={data} />
      </CardContent>
    </Card>
  );
}

async function SectionBody({ section, data }: { section: Section; data: OwnerAircraft }) {
  const a = data.aircraft;
  const id = a.id;

  switch (section) {
    case "details": {
      const units = await getUserUnits();
      return (
        <DetailsForm
          action={saveSection.bind(null, "details", id)}
          values={detailsValues(a, units)}
          units={units}
          registrationLocked={a.status !== "draft"}
        />
      );
    }
    case "equipment":
      return (
        <EquipmentForm
          action={saveSection.bind(null, "equipment", id)}
          values={{
            avionics: str(a.avionics),
            autopilot: on(a.autopilot),
            transponder: a.transponder,
            adsbOut: on(a.adsbOut),
            nightVfr: on(a.nightVfr),
            ifr: on(a.ifr),
            equipmentNotes: str(a.equipmentNotes),
            description: str(a.description),
          }}
        />
      );
    case "base":
      return (
        <BaseForm
          action={saveSection.bind(null, "base", id)}
          airport={await getAirport(a.homeAirportIdent)}
        />
      );
    case "pricing":
      return (
        <PricingForm
          action={saveSection.bind(null, "pricing", id)}
          values={{
            pricePerHour: str(a.pricePerHour),
            weekendPricePerHour: str(a.weekendPricePerHour),
            currency: a.currency,
            priceBasis: a.priceBasis,
            timeBasis: a.timeBasis,
            minHoursPerDay: str(a.minHoursPerDay),
            freeCancellationHours: String(a.freeCancellationHours),
            cancellationNote: str(a.cancellationNote),
          }}
        />
      );
    case "photos":
      return (
        <PhotosManager
          aircraftId={id}
          photos={data.photos.map((p) => ({ id: p.id, url: p.url }))}
        />
      );
    case "documents":
      return <DocumentsBody data={data} />;
    case "requirements": {
      const r = data.requirements;
      return (
        <RequirementsForm
          action={saveRequirements.bind(null, id)}
          icaoType={a.icaoType}
          values={{
            minPilotRating: str(r?.minPilotRating),
            minReviews: String(r?.minReviews ?? 1),
            unratedPolicy: r?.unratedPolicy ?? "checkout",
            licenceTypes: r?.licenceTypes ?? [],
            requiredRatings: r?.requiredRatings ?? [],
            minTotalHours: str(r?.minTotalHours),
            minTypeHours: str(r?.minTypeHours),
            min90DayHours: str(r?.min90DayHours),
            minAge: str(r?.minAge),
          }}
        />
      );
    }
  }
}

async function DocumentsBody({ data }: { data: OwnerAircraft }) {
  const t = await getTranslations("owner.documents");
  const tp = await getTranslations("pilot");
  const tf = await getTranslations("owner.files");
  const dateFormat = new Intl.DateTimeFormat(intlLocale(await getLocale()), {
    dateStyle: "medium",
    timeZone: "UTC",
  });
  const rows: DocumentRow[] = data.documents.map((d) => {
    const state = expiryState(d.expiresOn);
    const date = d.expiresOn ? dateFormat.format(new Date(`${d.expiresOn}T00:00:00Z`)) : "";
    return {
      id: d.id,
      kind: d.kind,
      status: d.status,
      expiresOn: d.expiresOn,
      expiry: {
        state,
        text: d.expiresOn ? tp(`expiry.${state}` as "expiry.valid", { date }) : "",
      },
      rejectionReason: d.rejectionReason,
      document: d.documentId ? { id: d.documentId, filename: d.filename ?? "" } : null,
    };
  });
  const action = saveAircraftDocument.bind(null, data.aircraft.id);

  return (
    <div className="grid gap-8">
      <div className="grid gap-4">
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
        {DOCUMENT_KINDS.map((kind) => (
          <AircraftDocumentCard
            key={kind}
            aircraftId={data.aircraft.id}
            kind={kind}
            row={rows.find((r) => r.kind === kind) ?? null}
            action={action}
          />
        ))}
      </div>
      <section aria-labelledby="reference-files" className="grid gap-3">
        <div>
          <h3 id="reference-files" className="font-medium">
            {tf("title")}
          </h3>
          <p className="text-sm text-muted-foreground">{tf("description")}</p>
        </div>
        <ReferenceFiles
          aircraftId={data.aircraft.id}
          files={data.files.map((f) => ({
            id: f.id,
            kind: f.kind,
            title: f.title,
            document: { id: f.documentId, filename: f.filename },
          }))}
          action={addAircraftFile.bind(null, data.aircraft.id)}
        />
      </section>
    </div>
  );
}
