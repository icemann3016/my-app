import type { Metadata } from "next";
import Link from "next/link";
import { FileTextIcon, TriangleAlertIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { SectionHeading } from "@/components/aircraft/section-heading";
import { ReportDefectDialog } from "@/components/bookings/report-defect-dialog";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requireOwnAircraft } from "@/lib/aircraft/owner";
import { getAircraftDefects } from "@/lib/bookings/defects";
import { intlLocale, type Locale } from "@/lib/i18n/config";
import { groundAircraft, resolveDefect } from "./actions";
import { ClearGrounding } from "./clear-grounding";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("aircraft.sections");
  return { title: t("defects") };
}

/** Defects reported on the aircraft; the owner grounds it or marks defects fixed (BKG-8). */
export default async function DefectsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, aircraft } = await requireOwnAircraft(id, "defects");
  const t = await getTranslations("defects");
  const ta = await getTranslations("aircraft");
  const rows = await getAircraftDefects(user.id, id);
  const open = rows.filter((r) => !r.defect.resolvedAt);
  const fixed = rows.filter((r) => r.defect.resolvedAt);
  const format = new Intl.DateTimeFormat(intlLocale((await getLocale()) as Locale), {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const grounded = aircraft.status === "grounded";

  return (
    <div className="grid gap-6">
      <SectionHeading title={ta("sections.defects")} text={ta("sectionText.defects")} />
      {grounded ? (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>{t("groundedTitle")}</AlertTitle>
          <AlertDescription className="grid gap-3">
            <p>{t("groundedText")}</p>
            <ClearGrounding id={id} />
          </AlertDescription>
        </Alert>
      ) : (
        aircraft.status !== "draft" && (
          <form action={groundAircraft} className="grid gap-2">
            <input type="hidden" name="aircraftId" value={id} />
            <p className="text-sm text-muted-foreground">{t("groundHint")}</p>
            <SubmitButton variant="destructive" className="justify-self-start">
              <TriangleAlertIcon aria-hidden /> {t("ground")}
            </SubmitButton>
          </form>
        )
      )}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle as="h2">{t("open")}</CardTitle>
          <ReportDefectDialog aircraftId={id} bookingId={null} />
        </CardHeader>
        <CardContent>
          {open.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noneOpen")}</p>
          ) : (
            <ul className="grid divide-y">
              {open.map(({ defect: d, reporter }) => (
                <li key={d.id} className="grid gap-2 py-3 text-sm first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={d.severity === "unsafe" ? "default" : "outline"}>
                      {t(`severities.${d.severity}`)}
                    </Badge>
                    <span className="text-muted-foreground">
                      {t("reportedBy", {
                        name: reporter ?? t("deletedUser"),
                        date: format.format(d.createdAt),
                      })}
                    </span>
                    {d.bookingId && (
                      <Link
                        href={`/bookings/${d.bookingId}`}
                        className="underline underline-offset-2"
                      >
                        {t("booking")}
                      </Link>
                    )}
                    {d.photoId && (
                      <a
                        href={`/api/documents/${d.photoId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 underline underline-offset-2"
                      >
                        <FileTextIcon className="size-3.5" aria-hidden /> {t("photoLink")}
                      </a>
                    )}
                  </div>
                  <p className="whitespace-pre-line">{d.description}</p>
                  <form action={resolveDefect} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="defectId" value={d.id} />
                    <input type="hidden" name="aircraftId" value={id} />
                    <Input
                      name="note"
                      maxLength={1000}
                      placeholder={t("resolutionPlaceholder")}
                      aria-label={t("resolution")}
                      className="max-w-sm"
                    />
                    <SubmitButton variant="outline" size="sm">
                      {t("markFixed")}
                    </SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {fixed.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle as="h2">{t("fixed")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid divide-y">
              {fixed.map(({ defect: d, reporter }) => (
                <li key={d.id} className="grid gap-1 py-3 text-sm first:pt-0 last:pb-0">
                  <span className="text-muted-foreground">
                    {t(`severities.${d.severity}`)} ·{" "}
                    {t("reportedBy", {
                      name: reporter ?? t("deletedUser"),
                      date: format.format(d.createdAt),
                    })}{" "}
                    · {t("fixedOn", { date: format.format(d.resolvedAt!) })}
                  </span>
                  <p className="whitespace-pre-line">{d.description}</p>
                  {d.resolution && <p className="text-muted-foreground">{d.resolution}</p>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      <p className="text-xs text-muted-foreground">{t("disclaimer")}</p>
    </div>
  );
}
