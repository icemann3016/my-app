import { EyeOffIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { ReviewCard } from "@/components/reviews/review-card";
import { ReviewForm } from "@/components/reviews/review-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatUtc } from "@/lib/aircraft/format";
import type { Locale } from "@/lib/i18n/config";
import { getBookingReviews } from "@/lib/reviews/queries";

/**
 * Reviews of a completed booking (RAT-1…3): the form while the window is open, then both
 * reviews. The other side's review shows only once both have reviewed or the window has closed.
 */
export async function BookingReviews({
  userId,
  bookingId,
  isPilot,
  otherName,
}: {
  userId: string;
  bookingId: string;
  isPilot: boolean;
  /** Pilot's name for the owner; aircraft and owner for the pilot. */
  otherName: string;
}) {
  const { mine, theirs, closesAt } = await getBookingReviews(userId, bookingId);
  if (!closesAt) return null;
  const t = await getTranslations("reviews");
  const locale = (await getLocale()) as Locale;
  const open = closesAt > new Date() && !mine;
  const closes = formatUtc(closesAt, locale);
  const direction = isPilot ? "pilot_to_owner" : "owner_to_pilot";

  return (
    <Card id="review">
      <CardHeader>
        <CardTitle as="h2">{t(open ? "writeTitle" : "title")}</CardTitle>
        {open && (
          <CardDescription>
            {t(isPilot ? "writeTextPilot" : "writeTextOwner", { name: otherName, date: closes })}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="grid gap-6">
        {open && <ReviewForm bookingId={bookingId} direction={direction} />}
        {!mine && !open && <p className="text-sm text-muted-foreground">{t("windowClosed")}</p>}
        {mine && (
          <div className="grid gap-2">
            <h3 className="text-sm font-medium text-muted-foreground">{t("yours")}</h3>
            <ReviewCard review={mine} />
            {!mine.publishedAt && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <EyeOffIcon className="size-4 shrink-0" aria-hidden />
                {t("hiddenUntil", { date: closes })}
              </p>
            )}
          </div>
        )}
        {theirs && (
          <div className="grid gap-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              {t(isPilot ? "fromOwner" : "fromPilot")}
            </h3>
            <ReviewCard review={theirs} viewerId={userId} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
