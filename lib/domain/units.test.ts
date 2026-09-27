import { describe, expect, it } from "vitest";

import { kgToMass, litresToVolume, massToKg, volumeToLitres } from "./units";

describe("unit conversions", () => {
  it("keeps metric values as they are", () => {
    expect(volumeToLitres(32.5, "metric")).toBe(32.5);
    expect(litresToVolume(32.5, "metric")).toBe(32.5);
    expect(massToKg(350, "metric")).toBe(350);
    expect(kgToMass(350, "metric")).toBe(350);
  });

  it("converts US gallons and pounds", () => {
    expect(volumeToLitres(10, "imperial")).toBe(37.9);
    expect(litresToVolume(37.9, "imperial")).toBe(10);
    expect(massToKg(1000, "imperial")).toBe(454);
    expect(kgToMass(454, "imperial")).toBe(1001);
  });
});
