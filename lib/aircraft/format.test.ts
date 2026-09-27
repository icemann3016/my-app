import { describe, expect, it } from "vitest";

import { formatMoney, formatNumber } from "./format";

describe("formatMoney", () => {
  it("formats in the viewer's language and hides .00", () => {
    expect(formatMoney(180, "EUR", "en")).toBe("€180");
    expect(formatMoney(180.5, "EUR", "en")).toBe("€180.50");
    expect(formatMoney(180, "EUR", "bg").replace(/\s/g, " ")).toBe("180 €");
    expect(formatNumber(34.06, "bg")).toBe("34,1");
  });
});
