import { describe, expect, it } from "vitest";

import { estimatePrice } from "./pricing";

const base = {
  pricePerHour: 180,
  weekendPricePerHour: null,
  minHoursPerDay: null,
  priceBasis: "wet" as const,
  fuelBurnLph: 36,
  plannedHours: 1.5,
  days: 1,
  weekend: false,
};

describe("price estimate", () => {
  it("charges the planned hours at the hourly rate", () => {
    expect(estimatePrice(base)).toEqual({
      rate: 180,
      billedHours: 1.5,
      amount: 270,
      fuelLitres: null,
    });
  });

  it("applies the weekend price and the daily minimum", () => {
    expect(
      estimatePrice({
        ...base,
        weekend: true,
        weekendPricePerHour: 200,
        minHoursPerDay: 2,
        days: 2,
      }),
    ).toMatchObject({ rate: 200, billedHours: 4, amount: 800 });
    // No weekend price set: the normal price applies.
    expect(estimatePrice({ ...base, weekend: true }).rate).toBe(180);
  });

  it("estimates the fuel a dry rental needs", () => {
    expect(estimatePrice({ ...base, priceBasis: "dry" }).fuelLitres).toBe(54);
  });
});
