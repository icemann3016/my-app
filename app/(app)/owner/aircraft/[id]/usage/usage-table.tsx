import { getLocale, getTranslations } from "next-intl/server";

import type { UsageTotals } from "@/lib/domain/usage";
import { litresToOil, litresToVolume, type UnitSystem } from "@/lib/domain/units";
import { intlLocale, type Locale } from "@/lib/i18n/config";

type Row = UsageTotals & { key: string; label: string };

/** A usage table that scrolls sideways on phones. Fuel in the user's units, oil in the dipstick unit. */
export async function UsageTable({
  rows,
  label,
  units,
  oilUnit,
  timeBasis,
}: {
  rows: Row[];
  /** Accessible name of the table. */
  label: string;
  units: UnitSystem;
  oilUnit: "qt" | "l";
  timeBasis: "hobbs" | "tach" | "block";
}) {
  const t = await getTranslations("usage");
  const tl = await getTranslations("flightLog");
  const number = new Intl.NumberFormat(intlLocale((await getLocale()) as Locale), {
    maximumFractionDigits: 1,
  });
  const rate = new Intl.NumberFormat(intlLocale((await getLocale()) as Locale), {
    maximumFractionDigits: 2,
  });
  const hours = (minutes: number) =>
    tl("duration", { h: Math.floor(minutes / 60), m: minutes % 60 });
  const fuelUnit = tl(units === "metric" ? "units.l" : "units.usgal");
  const oil = tl(oilUnit === "qt" ? "units.qt" : "units.l");
  const columns = [
    t("flights"),
    tl(`flown.${timeBasis}`),
    t("block"),
    t("engine"),
    t("landings"),
    t("fuel", { unit: fuelUnit }),
    t("oil", { unit: oil }),
    t("oilRate", { unit: oil }),
  ];
  return (
    <div className="-mx-2 overflow-x-auto px-2">
      <table className="w-full min-w-[40rem] text-sm" aria-label={label}>
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th scope="col" className="py-2 pr-3 font-medium">
              <span className="sr-only">{label}</span>
            </th>
            {columns.map((c) => (
              <th key={c} scope="col" className="py-2 pr-3 text-right font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b last:border-0">
              <th scope="row" className="py-2 pr-3 text-left font-medium">
                {r.label}
              </th>
              <td className="py-2 pr-3 text-right">{r.flights}</td>
              <td className="py-2 pr-3 text-right">{hours(r.flownMinutes)}</td>
              <td className="py-2 pr-3 text-right">{hours(r.blockMinutes)}</td>
              <td className="py-2 pr-3 text-right">{hours(r.engineMinutes)}</td>
              <td className="py-2 pr-3 text-right">{r.landings}</td>
              <td className="py-2 pr-3 text-right">
                {number.format(litresToVolume(r.fuelUsedL, units))}
              </td>
              <td className="py-2 pr-3 text-right">
                {number.format(litresToOil(r.oilUsedL, oilUnit))}
              </td>
              <td className="py-2 pr-3 text-right">
                {r.oilPerEngineHourL === null
                  ? "–"
                  : rate.format(litresToOil(r.oilPerEngineHourL, oilUnit))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
