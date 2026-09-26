import { describe, expect, it } from "vitest";

import { daysBetween, expiryState, isUsable } from "./validity";

describe("expiry", () => {
  const today = "2026-09-26";

  it("counts days between dates", () => {
    expect(daysBetween(today, "2026-10-26")).toBe(30);
    expect(daysBetween(today, "2026-09-25")).toBe(-1);
  });

  it("warns 30 days before expiry", () => {
    expect(expiryState(null, today)).toBe("none");
    expect(expiryState("2027-01-01", today)).toBe("valid");
    expect(expiryState("2026-10-26", today)).toBe("expiring");
    expect(expiryState(today, today)).toBe("expiring"); // valid through the last day
    expect(expiryState("2026-09-25", today)).toBe("expired");
  });

  it("only counts verified, unexpired credentials", () => {
    expect(isUsable({ status: "verified", expiresOn: "2027-01-01" }, today)).toBe(true);
    expect(isUsable({ status: "verified", expiresOn: null }, today)).toBe(true);
    expect(isUsable({ status: "pending", expiresOn: "2027-01-01" }, today)).toBe(false);
    expect(isUsable({ status: "verified", expiresOn: "2026-09-01" }, today)).toBe(false);
  });
});
