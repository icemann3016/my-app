import { describe, expect, it } from "vitest";

import { type UsageFlight, usageByMonth, usageByPilot, usageTotals } from "./usage";

const t = (iso: string) => new Date(iso);
const leg = (day: string, overrides: Partial<UsageFlight["legs"][number]> = {}) => ({
  blockOff: t(`${day}T08:00:00Z`),
  engineStart: t(`${day}T08:05:00Z`),
  engineStop: t(`${day}T09:05:00Z`),
  blockOn: t(`${day}T09:10:00Z`),
  landings: 1,
  fuelBeforeL: 120,
  fuelAfterL: 90,
  oilBeforeL: 6,
  oilAfterL: 5.9,
  ...overrides,
});

const flights: UsageFlight[] = [
  { bookingId: "a", pilotId: "p1", flownMinutes: 66, legs: [leg("2026-09-30")] },
  {
    bookingId: "b",
    pilotId: "p2",
    flownMinutes: 130,
    legs: [
      leg("2026-10-02", { landings: 3 }),
      leg("2026-10-02", { oilBeforeL: null, fuelAfterL: null }),
    ],
  },
];

describe("usage totals", () => {
  it("adds up time, landings, fuel and oil", () => {
    expect(usageTotals(flights)).toEqual({
      flights: 2,
      flownMinutes: 196,
      blockMinutes: 210,
      engineMinutes: 180,
      landings: 5,
      fuelUsedL: 60, // the leg without "fuel after" doesn't count
      oilUsedL: 0.2,
      oilPerEngineHourL: 0.1, // 0.2 L over the 2 engine hours with oil readings
    });
  });

  it("has no oil rate without oil readings", () => {
    const none = [{ ...flights[0]!, legs: [leg("2026-09-30", { oilAfterL: null })] }];
    expect(usageTotals(none).oilPerEngineHourL).toBeNull();
  });
});

describe("usage by month and pilot", () => {
  it("groups by the local month of the first leg, newest first", () => {
    // 2026-09-30 08:00 UTC is still September in Sofia.
    expect(usageByMonth(flights, "Europe/Sofia").map((m) => [m.month, m.flights])).toEqual([
      ["2026-10", 1],
      ["2026-09", 1],
    ]);
    const late = [
      { ...flights[0]!, legs: [leg("2026-09-30", { blockOff: t("2026-09-30T22:30:00Z") })] },
    ];
    expect(usageByMonth(late, "Europe/Sofia")[0]!.month).toBe("2026-10");
  });

  it("groups by pilot, most flown first", () => {
    expect(usageByPilot(flights).map((p) => [p.pilotId, p.flownMinutes])).toEqual([
      ["p2", 130],
      ["p1", 66],
    ]);
  });
});
