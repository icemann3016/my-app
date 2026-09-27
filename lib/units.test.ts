import { describe, expect, it } from "vitest";

import { massFromKg, massToKg, volumeFromLitres, volumeToLitres } from "./units";

describe("units", () => {
  it("shows fuel in litres or US gallons", () => {
    expect(volumeFromLitres(34, "metric")).toEqual({ value: 34, unit: "l" });
    expect(volumeFromLitres(34, "imperial")).toEqual({ value: 9, unit: "usgal" });
    expect(volumeToLitres(9, "imperial")).toBe(34.1);
    expect(volumeToLitres(34, "metric")).toBe(34);
  });

  it("shows weights in kg or lb and converts back", () => {
    expect(massFromKg(400, "imperial")).toEqual({ value: 882, unit: "lb" });
    expect(massToKg(882, "imperial")).toBe(400);
    expect(massFromKg(400.4, "metric")).toEqual({ value: 400, unit: "kg" });
  });
});
