import Link from "next/link";
import { PlaneIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { AircraftStatusBadge } from "@/components/aircraft/aircraft-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Dashboard } from "@/lib/dashboard";
import { BookingMiniList } from "./booking-mini-list";
import { Stat } from "./stat";

/** The owner's side: aircraft, bookings of them and rating, with links to each area. */
export async function OwnerCard({ owner }: { owner: NonNullable<Dashboard["owner"]> }) {
  const t = await getTranslations("dashboard.owner");
  const ta = await getTranslations("aircraft");
  const listed = owner.aircraft.filter((a) => a.status === "listed").length;
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2" className="flex items-center gap-2">
          <PlaneIcon className="size-5 text-primary" aria-hidden /> {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid grid-cols-3 gap-2">
          <Stat
            label={t("listed", { total: owner.aircraft.length })}
            value={String(listed)}
            href="/owner/aircraft"
          />
          <Stat label={t("upcoming")} value={String(owner.upcoming.length)} href="/bookings" />
          <Stat
            label={t("rating", { count: owner.rating.count })}
            value={
              owner.rating.count && owner.rating.avg !== null ? owner.rating.avg.toFixed(1) : "–"
            }
          />
        </div>
        <div className="grid gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">{t("aircraft")}</h3>
          {owner.aircraft.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noAircraft")}</p>
          ) : (
            <ul className="grid divide-y rounded-md border">
              {owner.aircraft.slice(0, 5).map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/owner/aircraft/${a.id}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm hover:bg-accent"
                  >
                    <span className="font-mono font-medium">{a.registration}</span>
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">
                      {a.manufacturer} {a.model}
                    </span>
                    <AircraftStatusBadge status={a.status} label={ta(`statuses.${a.status}`)} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <BookingMiniList
          title={t("nextBookings")}
          items={owner.upcoming.slice(0, 3)}
          empty={t("noUpcoming")}
        />
        <BookingMiniList
          title={t("recentBookings")}
          items={owner.past.slice(0, 3)}
          empty={t("noPast")}
        />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link href="/owner/aircraft">{t("myAircraft")}</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/owner/aircraft/new">{t("addAircraft")}</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/bookings">{t("allBookings")}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
