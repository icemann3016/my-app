import { describe, expect, it } from "vitest";

import { contactSchema } from "./profile";
import { reviewSchema, reviewScores } from "./review";

describe("contact phone", () => {
  const phone = (v: string) => contactSchema.safeParse({ phone: v });

  it("accepts international numbers and tidies them", () => {
    expect(phone("+359 (88) 123-4567").data?.phone).toBe("+359 88 123 4567");
    expect(phone("+4915112345678").data?.phone).toBe("+4915112345678");
    expect(phone("  ").data?.phone).toBeNull();
  });

  it("refuses numbers without a country code or with letters", () => {
    expect(phone("088 123 4567").success).toBe(false);
    expect(phone("+359 88 CALL ME").success).toBe(false);
    expect(phone("+12").success).toBe(false);
  });
});

describe("review form", () => {
  it("needs a whole score 1–5 for every category of the direction", () => {
    const base = { bookingId: "5a1ef6cf-4470-47c6-9f56-67fc28bdb766" };
    const good = {
      ...base,
      score_aircraft_condition: "5",
      score_communication: "4",
      score_value: "3",
    };
    const parsed = reviewSchema("pilot_to_owner").safeParse(good);
    expect(parsed.success).toBe(true);
    expect(reviewScores("pilot_to_owner", parsed.data!)).toEqual({
      aircraft_condition: 5,
      communication: 4,
      value: 3,
    });
    expect(reviewSchema("pilot_to_owner").safeParse({ ...good, score_value: "" }).success).toBe(
      false,
    );
    expect(reviewSchema("owner_to_pilot").safeParse(good).success).toBe(false);
  });
});
