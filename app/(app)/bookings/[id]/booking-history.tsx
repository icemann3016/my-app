import { getLocale, getTranslations } from "next-intl/server";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { intlLocale, type Locale } from "@/lib/i18n/config";

const KNOWN = new Set([
  "requested",
  "accepted",
  "declined",
  "proposed",
  "expired",
  "cancelled",
  "checked_out",
  "log_submitted",
  "log_correction",
  "log_confirmed",
  "defect_reported",
  "instant_booked",
]);

/** What happened to a booking, oldest first. */
export async function BookingHistory({
  events,
  timeZone,
}: {
  events: { id: string; type: string; createdAt: Date }[];
  timeZone: string;
}) {
  const t = await getTranslations("booking.history");
  const format = new Intl.DateTimeFormat(intlLocale((await getLocale()) as Locale), {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-2 text-sm">
          {events.map((e) => (
            <li key={e.id} className="flex flex-wrap justify-between gap-x-4">
              <span>{KNOWN.has(e.type) ? t(`types.${e.type as "requested"}`) : e.type}</span>
              <span className="text-muted-foreground">{format.format(e.createdAt)}</span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
