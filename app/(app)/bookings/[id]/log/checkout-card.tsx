import { FileTextIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { UploadedDocument } from "@/components/document-field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type VolumeUnit } from "@/lib/domain/units";
import { CheckoutForm } from "./checkout-form";

/** Check-out readings: a form while the pilot may change them, else read-only (BKG-7). */
export async function CheckoutCard({
  bookingId,
  logId,
  editable,
  values,
  photo,
  fuelUnit,
  oilUnit,
}: {
  bookingId: string;
  logId: string;
  editable: boolean;
  /** Readings as shown to the viewer (their units). */
  values: { hobbsStart: string; tachStart: string; fuelStart: string; oilStart: string };
  photo: UploadedDocument | null;
  fuelUnit: VolumeUnit;
  oilUnit: string;
}) {
  const t = await getTranslations("flightLog");
  const readings = [
    [t("hobbs"), values.hobbsStart],
    [t("tach"), values.tachStart],
    [t("fuelOnBoard", { unit: t(`units.${fuelUnit}`) }), values.fuelStart],
    [t("oilLevel", { unit: oilUnit }), values.oilStart],
  ] as const;
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">{t("checkout")}</CardTitle>
      </CardHeader>
      <CardContent>
        {editable ? (
          <CheckoutForm
            bookingId={bookingId}
            logId={logId}
            values={values}
            photo={photo}
            fuelUnit={fuelUnit}
            oilUnit={oilUnit}
          />
        ) : (
          <div className="grid gap-3 text-sm">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {readings.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-medium">{value || "–"}</dd>
                </div>
              ))}
            </dl>
            {photo && (
              <a
                href={`/api/documents/${photo.id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 justify-self-start underline underline-offset-2"
              >
                <FileTextIcon className="size-3.5" aria-hidden /> {t("checkoutPhotoLink")}
              </a>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
