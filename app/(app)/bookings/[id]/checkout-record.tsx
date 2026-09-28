import { GraduationCapIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCheckout } from "@/lib/bookings/checkouts";
import { intlLocale, type Locale } from "@/lib/i18n/config";
import { RecordCheckoutForm } from "./record-checkout-form";

/**
 * Checkout flight of this pilot on this aircraft (BKG-10): what the booking asks for, whether
 * it's recorded, and for the owner a form to record it.
 */
export async function CheckoutRecord({
  viewerId,
  isOwner,
  bookingId,
  aircraftId,
  pilotId,
  defaultDate,
  canRecord,
}: {
  viewerId: string;
  isOwner: boolean;
  bookingId: string;
  aircraftId: string;
  pilotId: string | null;
  defaultDate: string;
  /** The booking is accepted or later, so the flight can have happened. */
  canRecord: boolean;
}) {
  const t = await getTranslations("checkoutFlight");
  const done = pilotId ? await getCheckout(viewerId, aircraftId, pilotId) : null;
  const locale = (await getLocale()) as Locale;
  const date = (d: string) =>
    new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium", timeZone: "UTC" }).format(
      new Date(`${d}T00:00:00Z`),
    );

  if (done) {
    return (
      <p className="flex items-start gap-2 text-sm text-success">
        <GraduationCapIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t("done", { date: date(done.doneOn) })}
        {done.instructor && ` · ${t("instructorIs", { name: done.instructor })}`}
      </p>
    );
  }
  return (
    <div className="grid gap-3">
      <p className="flex items-start gap-2 text-sm">
        <GraduationCapIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        {t(isOwner ? "neededOwner" : "neededPilot")}
      </p>
      {isOwner && canRecord && pilotId && (
        <Card>
          <CardHeader>
            <CardTitle as="h2">{t("recordTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <RecordCheckoutForm bookingId={bookingId} defaultDate={defaultDate} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
