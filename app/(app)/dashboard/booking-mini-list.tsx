import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { BookingStatusBadge } from "@/components/bookings/booking-status-badge";
import { formatSpan } from "@/lib/aircraft/format";
import type { BookingListItem } from "@/lib/bookings/queries";
import type { Locale } from "@/lib/i18n/config";

/** A few bookings, each linking to its page. */
export async function BookingMiniList({
  title,
  items,
  empty,
}: {
  title: string;
  items: BookingListItem[];
  empty: string;
}) {
  const t = await getTranslations("booking");
  const locale = (await getLocale()) as Locale;
  return (
    <div className="grid gap-2">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="grid divide-y rounded-md border">
          {items.map((b) => (
            <li key={b.id}>
              <Link
                href={`/bookings/${b.id}`}
                className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-accent"
              >
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="flex items-baseline gap-2">
                    <span className="font-mono font-medium">{b.aircraft.registration}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {b.departureIdent === b.arrivalIdent
                        ? b.departureIdent
                        : `${b.departureIdent} → ${b.arrivalIdent}`}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatSpan(b.from, b.to, locale)}
                  </span>
                </span>
                <BookingStatusBadge status={b.status} label={t(`statuses.${b.status}`)} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
