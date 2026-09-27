import type { Metadata } from "next";
import { Trash2Icon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { MonthCalendar } from "@/components/aircraft/month-calendar";
import { SectionHeading } from "@/components/aircraft/section-heading";
import { SubmitButton } from "@/components/forms/submit-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCalendarEntries } from "@/lib/aircraft/calendar";
import { formatSpan } from "@/lib/aircraft/format";
import { requireOwnAircraft } from "@/lib/aircraft/owner";
import { getAirport } from "@/lib/airports";
import { addDays, addMonths, zonedDay, zonedToUtc } from "@/lib/domain/time";
import type { Locale } from "@/lib/i18n/config";
import { deleteCalendarBlock } from "./actions";
import { BlockForm } from "./block-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("aircraft.sections");
  return { title: t("calendar") };
}

/** The owner's calendar: own use, maintenance and unavailable blocks; bookings (SRC-5). */
export default async function CalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { id } = await params;
  const { user, aircraft } = await requireOwnAircraft(id, "calendar");
  const t = await getTranslations("aircraft");
  const locale = (await getLocale()) as Locale;
  const timeZone = (await getAirport(aircraft.homeAirportIdent))?.timezone ?? "UTC";
  const now = new Date();
  const requested = (await searchParams).month;
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(requested ?? "")
    ? requested!
    : zonedDay(now, timeZone).slice(0, 7);

  const monthStart = zonedToUtc(`${month}-01`, timeZone)!;
  const monthEnd = zonedToUtc(`${addMonths(month, 1)}-01`, timeZone)!;
  const [inMonth, upcoming] = await Promise.all([
    getCalendarEntries(user.id, id, monthStart, monthEnd),
    getCalendarEntries(
      user.id,
      id,
      now,
      zonedToUtc(addDays(zonedDay(now, timeZone), 400), timeZone)!,
    ),
  ]);

  return (
    <div className="grid gap-6">
      <SectionHeading title={t("sections.calendar")} text={t("sectionText.calendar")} />
      <Card>
        <CardContent>
          <MonthCalendar
            month={month}
            timeZone={timeZone}
            locale={locale}
            spans={inMonth}
            mode="owner"
            basePath={`/owner/aircraft/${id}/calendar`}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">{t("calendar.addTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <BlockForm aircraftId={id} timeZone={timeZone} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">{t("calendar.upcoming")}</CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("calendar.nothingPlanned")}</p>
          ) : (
            <ul className="grid divide-y">
              {upcoming.map((entry) => {
                const span = formatSpan(entry.from, entry.to, timeZone, locale);
                return (
                  <li key={entry.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="grid min-w-0 flex-1 gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{t(`calendar.kinds.${entry.kind}`)}</Badge>
                        <span className="text-sm font-medium">{span.local}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{span.utc}</span>
                      {entry.note && <p className="text-sm break-words">{entry.note}</p>}
                    </div>
                    {entry.kind !== "booking" && (
                      <form action={deleteCalendarBlock}>
                        <input type="hidden" name="aircraftId" value={id} />
                        <input type="hidden" name="id" value={entry.id} />
                        <SubmitButton
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          aria-label={t("calendar.remove", { when: span.local })}
                        >
                          <Trash2Icon aria-hidden />
                        </SubmitButton>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
