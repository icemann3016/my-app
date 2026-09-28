import { getTranslations } from "next-intl/server";

import { ReviewList } from "@/components/reviews/review-list";
import { Card, CardContent } from "@/components/ui/card";
import { categoryAverages, listPublishedReviews } from "@/lib/reviews/queries";

type Rating = { average: number | null; count: number };

/** Reviews a person received as a pilot and as an owner (RAT-1, RAT-2). */
export async function ProfileReviews({
  userId,
  asPilot,
  asOwner,
  viewerId,
}: {
  userId: string;
  viewerId: string | null;
  /** Null when the person isn't a pilot and has no reviews as one. */
  asPilot: Rating | null;
  asOwner: Rating | null;
}) {
  const t = await getTranslations("reviews");
  const sections = [
    { direction: "owner_to_pilot" as const, rating: asPilot, title: t("asPilot") },
    { direction: "pilot_to_owner" as const, rating: asOwner, title: t("asOwner") },
  ].filter((s) => s.rating);
  if (!sections.length) return null;
  const loaded = await Promise.all(
    sections.map(async (s) => {
      const about = { userId, direction: s.direction };
      const [reviews, categories] = s.rating!.count
        ? await Promise.all([listPublishedReviews(about), categoryAverages(about)])
        : [[], {}];
      return { ...s, reviews, categories };
    }),
  );
  return (
    <Card>
      <CardContent className="grid gap-8">
        {loaded.map((s) => (
          <ReviewList
            key={s.direction}
            id={`reviews-${s.direction}`}
            title={s.title}
            direction={s.direction}
            average={s.rating!.average}
            count={s.rating!.count}
            categories={s.categories}
            reviews={s.reviews}
            showAircraft={s.direction === "pilot_to_owner"}
            viewerId={viewerId}
          />
        ))}
      </CardContent>
    </Card>
  );
}
