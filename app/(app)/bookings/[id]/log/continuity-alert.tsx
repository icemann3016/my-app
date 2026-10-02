import { TriangleAlertIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Alert, AlertDescription } from "@/components/ui/alert";
import type { ContinuityIssue } from "@/lib/domain/fuel-checks";
import { litresToOil, litresToVolume, type UnitSystem } from "@/lib/domain/units";

/**
 * Fuel or oil readings that went up between legs by more than was recorded as added, or fuel and
 * oil added somewhere the aircraft never was (BKG-13, BKG-14). Shown to pilot and owner.
 */
export async function ContinuityAlert({
  issues,
  units,
  dipstick,
}: {
  issues: ContinuityIssue[];
  units: UnitSystem;
  dipstick: "qt" | "l";
}) {
  if (!issues.length) return null;
  const t = await getTranslations("flightLog.continuity");
  const tu = await getTranslations("flightLog.units");
  const amount = (kind: "fuel" | "oil", litres: number) =>
    kind === "fuel"
      ? `${litresToVolume(litres, units)} ${tu(units === "metric" ? "l" : "usgal")}`
      : `${litresToOil(litres, dipstick)} ${tu(dipstick)}`;
  return (
    <Alert>
      <TriangleAlertIcon />
      <AlertDescription>
        <p className="font-medium">{t("title")}</p>
        <ul className="list-disc pl-5">
          {issues.map((i) => (
            <li key={`${i.type}-${i.kind}-${i.type === "rose" ? i.seq : i.airport}`}>
              {i.type === "offRoute"
                ? t(`offRoute.${i.kind}`, { airport: i.airport })
                : t(`rose.${i.kind}`, {
                    leg: i.seq,
                    airport: i.airport,
                    rise: amount(i.kind, i.riseL),
                    recorded: amount(i.kind, i.recordedL),
                  })}
            </li>
          ))}
        </ul>
        <p>{t("hint")}</p>
      </AlertDescription>
    </Alert>
  );
}
