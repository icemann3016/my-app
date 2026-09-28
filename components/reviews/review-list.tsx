import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";

import type { ReviewDirection } from "@/lib/db/schema";
import { REVIEW_CATEGORIES } from "@/lib/reviews/categories";
import type { ReviewView } from "@/lib/reviews/queries";
import { ReviewCard } from "./review-card";
import { Stars } from "./stars";

/**
 * Published reviews with the average overall and per-category scores (RAT-2), for a profile or
 * an aircraft page.
 */
export async function ReviewList({
  id,
  title,
  direction,
  average,
  count,
  categories,
  reviews,
  showAircraft = false,
  actions,
}: {
  /** Heading id. */
  id: string;
  title: string;
  direction: ReviewDirection;
  average: number | null;
  count: number;
  categories: Record<string, number>;
  reviews: ReviewView[];
  showAircraft?: boolean;
  actions?: (review: ReviewView) => ReactNode;
}) {
  const t = await getTranslations("reviews");
  return (
    <section aria-labelledby={id} className="grid gap-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 id={id} className="text-lg font-semibold">
          {title}
        </h2>
        {count > 0 && average !== null && (
          <span className="flex items-center gap-1.5 text-sm">
            <Stars value={average} label={t("outOfFive", { score: average.toFixed(1) })} />
            <span className="font-medium">{average.toFixed(1)}</span>
            <span className="text-muted-foreground">{t("count", { count })}</span>
          </span>
        )}
      </div>
      {count === 0 || reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("none")}</p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
            {REVIEW_CATEGORIES[direction].map((c) =>
              categories[c] !== undefined ? (
                <div key={c}>
                  <dt className="text-xs text-muted-foreground">{t(`categories.${c}.label`)}</dt>
                  <dd className="font-medium">{categories[c]!.toFixed(1)}</dd>
                </div>
              ) : null,
            )}
          </dl>
          <ul className="grid divide-y">
            {reviews.map((r) => (
              <li key={r.id} className="py-4 first:pt-0 last:pb-0">
                <ReviewCard review={r} showAircraft={showAircraft} actions={actions?.(r)} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
