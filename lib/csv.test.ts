import { describe, expect, it } from "vitest";

import { toCsv } from "./csv";

describe("toCsv", () => {
  it("quotes commas, quotes and line breaks, and leaves empty cells for null", () => {
    expect(toCsv(["a", "b", "c"], [['LZ-ABC, "Skyhawk"', null, 1.5]])).toBe(
      '﻿a,b,c\r\n"LZ-ABC, ""Skyhawk""",,1.5\r\n',
    );
  });

  it("stops text from running as a formula, but keeps negative numbers", () => {
    expect(toCsv(["x", "y", "z"], [["=HYPERLINK(1)", "@SUM(A1)", -5]])).toBe(
      "﻿x,y,z\r\n'=HYPERLINK(1),'@SUM(A1),-5\r\n",
    );
  });
});
