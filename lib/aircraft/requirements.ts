import type { RentalRequirements } from "@/lib/db/schema";
import {
  CLASS_RATINGS,
  LICENCE_LABELS,
  type LicenceTypeCode,
  PRIVILEGES,
} from "@/lib/pilot/catalog";
import type { PilotTranslate } from "@/lib/pilot/labels";

/**
 * Rental requirements as short sentences for the aircraft page, e.g.
 * "Pilot rating 4.0 or higher", "At least 100 h total". `t` translates keys under
 * "aircraft.requirements"; `tp` under "pilot". Empty = no requirements beyond valid credentials.
 */
export function describeRequirements(
  r: Pick<
    RentalRequirements,
    | "minPilotRating"
    | "minReviews"
    | "unratedPolicy"
    | "licenceTypes"
    | "requiredRatings"
    | "minTotalHours"
    | "minTypeHours"
    | "min90DayHours"
    | "minAge"
  > | null,
  icaoType: string | null,
  t: PilotTranslate,
  tp: PilotTranslate,
  formatNumber: (n: number) => string,
): string[] {
  if (!r) return [];
  const lines: string[] = [];
  if (r.minPilotRating !== null) {
    lines.push(t("minRating", { rating: r.minPilotRating.toFixed(1) }));
  }
  lines.push(t(`unrated.${r.unratedPolicy}`, { count: String(r.minReviews) }));
  if (r.licenceTypes.length) {
    const names = r.licenceTypes.map(
      (l) => LICENCE_LABELS[l as LicenceTypeCode] ?? tp("licences.other"),
    );
    lines.push(t("licences", { list: names.join(", ") }));
  }
  if (r.requiredRatings.length) {
    const names = r.requiredRatings.map((code) =>
      (CLASS_RATINGS as readonly string[]).includes(code)
        ? tp(`classRatings.${code}`)
        : (PRIVILEGES as readonly string[]).includes(code)
          ? tp(`privileges.${code}`)
          : tp("ratings.typeLabel", { code }),
    );
    lines.push(t("ratings", { list: names.join(", ") }));
  }
  if (r.minTotalHours !== null)
    lines.push(t("totalHours", { hours: formatNumber(r.minTotalHours) }));
  if (r.minTypeHours !== null) {
    lines.push(
      icaoType
        ? t("typeHoursOn", { hours: formatNumber(r.minTypeHours), type: icaoType })
        : t("typeHours", { hours: formatNumber(r.minTypeHours) }),
    );
  }
  if (r.min90DayHours !== null) {
    lines.push(t("recentHours", { hours: formatNumber(r.min90DayHours) }));
  }
  if (r.minAge !== null) lines.push(t("minAge", { age: String(r.minAge) }));
  return lines;
}
