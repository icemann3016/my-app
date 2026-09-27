import { describe, expect, it } from "vitest";

import { eligibilityText } from "./eligibility-text";

// Stand-in translators that show the key and values.
const t = (key: string, values?: Record<string, string | number>) =>
  values ? `${key} ${JSON.stringify(values)}` : key;
const tp = (key: string, values?: Record<string, string>) =>
  values ? `${key} ${JSON.stringify(values)}` : key;
const f = (requirement: string, need: string | null = null, have: string | null = null) => ({
  requirement,
  blocking: true,
  need,
  have,
});

describe("eligibility reasons", () => {
  it("turns hours and ages into numbers", () => {
    expect(eligibilityText(f("type_hours", "50.0", "12.5"), t, tp, "DA40")).toBe(
      'type_hours {"need":50,"have":12.5,"type":"DA40"}',
    );
    expect(eligibilityText(f("age", "21", "19"), t, tp, "C172")).toBe('age {"need":21,"have":19}');
  });

  it("names licences and ratings", () => {
    expect(eligibilityText(f("licence_type", "lapl_a,ppl_a"), t, tp, "C172")).toBe(
      'licence_type {"list":"LAPL(A), PPL(A)"}',
    );
    expect(eligibilityText(f("rating", "NIGHT"), t, tp, "C172")).toBe(
      'rating {"rating":"privileges.NIGHT"}',
    );
    expect(eligibilityText(f("rating", "C510"), t, tp, "C172")).toBe(
      'rating {"rating":"ratings.typeLabel {\\"code\\":\\"C510\\"}"}',
    );
    expect(eligibilityText(f("class_rating", "SEP_LAND"), t, tp, "C172")).toBe(
      'class_rating {"rating":"classRatings.SEP_LAND"}',
    );
  });

  it("has a fallback for unknown codes", () => {
    expect(eligibilityText(f("medical"), t, tp, "C172")).toBe("medical");
    expect(eligibilityText(f("something_new"), t, tp, "C172")).toBe("unknown");
  });
});
