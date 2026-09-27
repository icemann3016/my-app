import { describe, expect, it } from "vitest";

import { amountDue, flownMinutes } from "./flight-log";

const leg = (
  from: string,
  to: string,
  hobbs: [number, number] | null,
  tach: [number, number] | null,
) => ({
  blockOff: new Date(from),
  blockOn: new Date(to),
  hobbsStart: hobbs?.[0] ?? null,
  hobbsEnd: hobbs?.[1] ?? null,
  tachStart: tach?.[0] ?? null,
  tachEnd: tach?.[1] ?? null,
});

const legs = [
  leg("2026-10-01T08:00:00Z", "2026-10-01T09:10:00Z", [1234.5, 1235.6], [980.1, 981.0]),
  leg("2026-10-01T10:00:00Z", "2026-10-01T10:50:00Z", [1235.6, 1236.3], [981.0, 981.55]),
];

describe("flown time", () => {
  it("sums Hobbs, tach or block time", () => {
    expect(flownMinutes(legs, "hobbs")).toBe(108); // 1.1 h + 0.7 h
    expect(flownMinutes(legs, "tach")).toBe(87); // 0.9 h + 0.55 h
    expect(flownMinutes(legs, "block")).toBe(120); // 70 + 50 min
  });

  it("can't work out meter time without the readings", () => {
    expect(
      flownMinutes([leg("2026-10-01T08:00:00Z", "2026-10-01T09:00:00Z", null, null)], "hobbs"),
    ).toBeNull();
  });
});

describe("amount due", () => {
  const base = {
    pricePerHour: 180,
    weekendPricePerHour: 200,
    minHoursPerDay: null,
    days: 1,
    weekend: false,
    fuelAdjustment: 0,
  };

  it("charges flown hours at the rate", () => {
    expect(amountDue({ ...base, flownMinutes: 108 })).toEqual({
      hours: 1.8,
      rate: 180,
      amount: 324,
    });
  });

  it("applies the weekend rate, the daily minimum and the fuel adjustment", () => {
    expect(
      amountDue({
        ...base,
        flownMinutes: 60,
        weekend: true,
        minHoursPerDay: 2,
        fuelAdjustment: -45.5,
      }),
    ).toEqual({
      hours: 2,
      rate: 200,
      amount: 354.5,
    });
  });
});
