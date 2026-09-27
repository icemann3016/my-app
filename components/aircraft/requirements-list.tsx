import { CircleCheckIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { splitRatings } from "@/lib/aircraft/requirements";
import type { RentalRequirements } from "@/lib/db/schema";
import { CLASS_RATINGS, LICENCE_LABELS, type LicenceTypeCode } from "@/lib/pilot/catalog";
import { credentialLabel, type PilotTranslate } from "@/lib/pilot/labels";

/** An aircraft's rental requirements as a readable list (RAT-6, RAT-7). */
export async function RequirementsList({
  requirements: r,
  typeDesignator,
}: {
  requirements: RentalRequirements | null;
  typeDesignator: string;
}) {
  const t = await getTranslations("aircraft.requirementsList");
  const tp = (await getTranslations("pilot")) as unknown as PilotTranslate;
  const lines: string[] = [t("verified")];

  if (r?.licenceTypes.length) {
    const names = r.licenceTypes.map(
      (l) => LICENCE_LABELS[l as LicenceTypeCode] ?? tp("licences.other"),
    );
    lines.push(t("licences", { list: names.join(", ") }));
  }
  if (r?.requiredRatings.length) {
    const { listed, types } = splitRatings(r.requiredRatings);
    const names = [
      ...listed.map((code) =>
        credentialLabel(
          {
            kind: "rating",
            ratingKind: (CLASS_RATINGS as readonly string[]).includes(code) ? "class" : "privilege",
            code,
          },
          tp,
        ),
      ),
      ...types.map((code) => credentialLabel({ kind: "rating", ratingKind: "type", code }, tp)),
    ];
    lines.push(t("ratings", { list: names.join(", ") }));
  }
  if (r?.minTotalHours) lines.push(t("totalHours", { hours: r.minTotalHours }));
  if (r?.minTypeHours) lines.push(t("typeHours", { hours: r.minTypeHours, type: typeDesignator }));
  if (r?.min90DaysHours) lines.push(t("recentHours", { hours: r.min90DaysHours }));
  if (r?.minAge) lines.push(t("age", { age: r.minAge }));
  if (r?.minPilotRating) lines.push(t("rating", { rating: r.minPilotRating.toFixed(1) }));
  if (r && !r.allowUnrated) lines.push(t("noUnrated"));
  else if (r?.unratedNeedsCheckout) lines.push(t("unratedCheckout"));
  else lines.push(t("unratedWelcome"));

  return (
    <ul className="grid gap-2 text-sm">
      {lines.map((line) => (
        <li key={line} className="flex items-start gap-2">
          <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          {line}
        </li>
      ))}
    </ul>
  );
}
