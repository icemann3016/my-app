import { TriangleAlertIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPrice } from "@/lib/aircraft/format";
import type { bookingAmount } from "@/lib/bookings/amount";
import type { FlightLogStatus } from "@/lib/db/schema";
import type { Locale } from "@/lib/i18n/config";
import { OwnerActions, SubmitLog } from "./log-actions";

/** Flown time, fuel settlement and amount due, with check-in and confirmation (BKG-7, BKG-13). */
export async function LogSummary({
  bookingId,
  logId,
  role,
  status,
  editable,
  hasLegs,
  timeBasis,
  priceBasis,
  currency,
  result,
  confirmedAmount,
  unpriced,
}: {
  bookingId: string;
  logId: string;
  role: "pilot" | "owner";
  status: FlightLogStatus;
  editable: boolean;
  hasLegs: boolean;
  timeBasis: "hobbs" | "tach" | "block";
  priceBasis: "wet" | "dry";
  currency: string;
  result: ReturnType<typeof bookingAmount>;
  /** Stored when the owner confirmed. */
  confirmedAmount: number | null;
  /** Fuel or oil entries that count but have no price. */
  unpriced: number;
}) {
  const t = await getTranslations("flightLog");
  const locale = (await getLocale()) as Locale;
  const price = (n: number) => formatPrice(n, currency, locale);
  const open = status === "draft" || status === "correction_requested";
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">{t("summary")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm">
        {result ? (
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">{t(`flown.${timeBasis}`)}</dt>
              <dd className="font-medium">
                {t("duration", { h: Math.floor(result.minutes / 60), m: result.minutes % 60 })}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("billed")}</dt>
              <dd className="font-medium">
                {t("billedHours", { hours: result.hours })} × {price(result.rate)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("fuelAdjustment")}</dt>
              <dd className="font-medium">
                {result.fuelAdjustment > 0 ? "+" : ""}
                {price(result.fuelAdjustment)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("amountDue")}</dt>
              <dd className="font-medium">{price(confirmedAmount ?? result.amount)}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-destructive">
            {t("missingMeters", { basis: t(`basis.${timeBasis}`) })}
          </p>
        )}
        {unpriced > 0 && status !== "confirmed" && (
          <p className="flex items-start gap-2 text-warning">
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t("unpriced", { count: unpriced })}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {t(`fuelRule.${priceBasis}`)} {t("payDirectly")}
        </p>
        {editable && <SubmitLog bookingId={bookingId} logId={logId} disabled={!hasLegs} />}
        {role === "owner" && status === "submitted" && (
          <OwnerActions bookingId={bookingId} logId={logId} canConfirm={Boolean(result)} />
        )}
        {role === "pilot" && status === "submitted" && <p>{t("waitingForOwner")}</p>}
        {role === "owner" && open && <p>{t("waitingForPilot")}</p>}
      </CardContent>
    </Card>
  );
}
