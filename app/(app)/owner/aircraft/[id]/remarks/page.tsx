import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { SectionHeading } from "@/components/aircraft/section-heading";
import { KnownItemForm } from "@/components/bookings/known-item-form";
import { KnownItems } from "@/components/bookings/known-items";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireOwnAircraft } from "@/lib/aircraft/owner";
import { getAircraftRemarks, getKnownItems } from "@/lib/bookings/remarks";
import { intlLocale, type Locale } from "@/lib/i18n/config";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("aircraft.sections");
  return { title: t("remarks") };
}

/** Everything pilots noted about this aircraft; the owner picks the known items (BKG-15). */
export default async function RemarksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await requireOwnAircraft(id, "remarks");
  const t = await getTranslations("aircraft");
  const tr = await getTranslations("flightLog.remarks");
  const [rows, known] = await Promise.all([
    getAircraftRemarks(user.id, id),
    getKnownItems(user.id, id),
  ]);
  const timeZone = "UTC";
  const format = new Intl.DateTimeFormat(intlLocale((await getLocale()) as Locale), {
    dateStyle: "medium",
    timeZone,
  });

  return (
    <div className="grid gap-6">
      <SectionHeading title={t("sections.remarks")} text={t("sectionText.remarks")} />
      <KnownItems items={known} />
      <Card>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{tr("noneYet")}</p>
          ) : (
            <ul className="grid divide-y">
              {rows.map(({ remark: r, bookingId, flownFrom, airportCode }) => {
                const known = r.knownSince !== null;
                const resolved = r.resolvedAt !== null;
                return (
                  <li key={r.id} className="grid gap-1 py-3 text-sm first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{tr(`kinds.${r.kind}`)}</span>
                        {airportCode && (
                          <span className="text-muted-foreground">{airportCode}</span>
                        )}
                        <Link
                          href={`/bookings/${bookingId}/log`}
                          className="text-muted-foreground underline underline-offset-2"
                        >
                          {format.format(new Date(flownFrom))}
                        </Link>
                        {known && (
                          <Badge variant={resolved ? "secondary" : "outline"}>
                            {tr(resolved ? "fixed" : "known")}
                          </Badge>
                        )}
                      </span>
                      {r.kind === "aircraft" && (
                        <KnownItemForm remarkId={r.id} known={known} resolved={resolved} />
                      )}
                    </div>
                    <p className="whitespace-pre-line">{r.body}</p>
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
