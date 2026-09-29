import Link from "next/link";
import { PlaneTakeoffIcon, ShieldCheckIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Dashboard } from "@/lib/dashboard";
import { BookingMiniList } from "./booking-mini-list";
import { Stat } from "./stat";

/** The pilot's side: flights, credentials and rating, with links to each area. */
export async function PilotCard({ pilot }: { pilot: NonNullable<Dashboard["pilot"]> }) {
  const t = await getTranslations("dashboard.pilot");
  const c = pilot.credentials;
  const status = !c
    ? t("credentials.missing")
    : c.verified
      ? t("credentials.verified")
      : c.rejected
        ? t("credentials.rejected")
        : c.pending
          ? t("credentials.pending")
          : t("credentials.missing");
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2" className="flex items-center gap-2">
          <PlaneTakeoffIcon className="size-5 text-primary" aria-hidden /> {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid grid-cols-3 gap-2">
          <Stat label={t("upcoming")} value={String(pilot.upcoming.length)} href="/bookings" />
          <Stat label={t("completed")} value={String(pilot.completed)} href="/bookings" />
          <Stat
            label={t("rating", { count: pilot.rating.count })}
            value={
              pilot.rating.count && pilot.rating.avg !== null ? pilot.rating.avg.toFixed(1) : "–"
            }
          />
        </div>
        <Link
          href="/account/credentials"
          className="flex items-center gap-2 rounded-md border p-3 text-sm hover:bg-accent"
        >
          <ShieldCheckIcon
            className={c?.verified ? "size-4 text-success" : "size-4 text-warning"}
            aria-hidden
          />
          <span className="flex-1">{status}</span>
          <span className="text-xs text-muted-foreground">
            {c ? t("credentials.counts", { pending: c.pending, expiring: c.expiring.length }) : ""}
          </span>
        </Link>
        <BookingMiniList
          title={t("nextFlights")}
          items={pilot.upcoming.slice(0, 3)}
          empty={t("noUpcoming")}
        />
        <BookingMiniList
          title={t("recentFlights")}
          items={pilot.past.slice(0, 3)}
          empty={t("noPast")}
        />
      </CardContent>
    </Card>
  );
}
