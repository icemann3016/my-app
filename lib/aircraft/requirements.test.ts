import { describe, expect, it } from "vitest";

import { describeRequirements } from "./requirements";

const t = (key: string, values?: Record<string, string>) =>
  `${key}${values ? JSON.stringify(values) : ""}`;

describe("describeRequirements", () => {
  it("lists only the requirements the owner set", () => {
    const lines = describeRequirements(
      {
        minPilotRating: 4,
        minReviews: 2,
        unratedPolicy: "checkout",
        licenceTypes: ["ppl_a"],
        requiredRatings: ["SEP_LAND", "NIGHT", "C510"],
        minTotalHours: 100,
        minTypeHours: 10,
        min90DayHours: null,
        minAge: null,
      },
      "C172",
      t,
      t,
      String,
    );
    expect(lines).toEqual([
      'minRating{"rating":"4.0"}',
      'unrated.checkout{"count":"2"}',
      'licences{"list":"PPL(A)"}',
      'ratings{"list":"classRatings.SEP_LAND, privileges.NIGHT, ratings.typeLabel{\\"code\\":\\"C510\\"}"}',
      'totalHours{"hours":"100"}',
      'typeHoursOn{"hours":"10","type":"C172"}',
    ]);
  });
});
