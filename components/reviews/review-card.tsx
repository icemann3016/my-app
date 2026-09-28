import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { ReportDialog } from "@/components/reports/report-dialog";
import { UserAvatar } from "@/components/user-avatar";
import { avatarUrl } from "@/lib/avatar-url";
import { intlLocale, type Locale } from "@/lib/i18n/config";
import { REVIEW_CATEGORIES } from "@/lib/reviews/categories";
import type { ReviewView } from "@/lib/reviews/queries";
import { ReplyDialog } from "./reply-dialog";
import { Stars } from "./stars";

/** One review: author, date, overall and category scores, comment and the owner's reply. */
export async function ReviewCard({
  review: r,
  showAircraft = false,
  viewerId = null,
}: {
  review: ReviewView;
  /** Name the aircraft (on a person's profile). */
  showAircraft?: boolean;
  /** Logged-in viewer: may report it, or reply when it's about them as an owner. */
  viewerId?: string | null;
}) {
  const t = await getTranslations("reviews");
  const locale = (await getLocale()) as Locale;
  const date = new Intl.DateTimeFormat(intlLocale(locale), {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(r.publishedAt ?? r.submittedAt);
  const name = r.author?.name ?? t("deletedUser");
  return (
    <article className="grid gap-2" aria-label={t("reviewBy", { name })}>
      <div className="flex flex-wrap items-center gap-2">
        <UserAvatar name={name} url={avatarUrl(r.author?.avatarKey ?? null)} size={32} />
        <div className="grid min-w-0 flex-1">
          {r.author && r.authorId ? (
            <Link
              href={`/u/${r.authorId}`}
              className="truncate text-sm font-medium hover:underline"
            >
              {name}
            </Link>
          ) : (
            <span className="text-sm font-medium">{name}</span>
          )}
          <span className="text-xs text-muted-foreground">
            {date}
            {showAircraft && r.aircraft && (
              <>
                {" · "}
                <Link href={`/aircraft/${r.aircraft.id}`} className="hover:underline">
                  {r.aircraft.registration}
                </Link>
              </>
            )}
          </span>
        </div>
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <Stars value={r.overall} label={t("outOfFive", { score: r.overall.toFixed(1) })} />
          {r.overall.toFixed(1)}
        </span>
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        {REVIEW_CATEGORIES[r.direction].map((c) => (
          <li key={c}>
            {t(`categories.${c}.label`)}: <span className="text-foreground">{r.scores[c]}</span>/5
          </li>
        ))}
      </ul>
      {r.comment && <p className="text-sm leading-relaxed whitespace-pre-line">{r.comment}</p>}
      {r.reply && (
        <div className="ml-4 border-l-2 pl-3 text-sm">
          <p className="text-xs font-medium text-muted-foreground">{t("ownerReply")}</p>
          <p className="leading-relaxed whitespace-pre-line">{r.reply}</p>
        </div>
      )}
      {viewerId && (
        <div className="flex flex-wrap items-center gap-2">
          {viewerId === r.subjectUserId &&
            r.direction === "pilot_to_owner" &&
            r.publishedAt &&
            !r.hiddenAt &&
            !r.reply && <ReplyDialog reviewId={r.id} />}
          {viewerId !== r.authorId && r.publishedAt && (
            <ReportDialog targetType="review" targetId={r.id} />
          )}
        </div>
      )}
    </article>
  );
}
