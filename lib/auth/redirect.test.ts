import { describe, expect, it } from "vitest";

import { safeNextPath } from "./redirect";

describe("safeNextPath", () => {
  it("keeps paths on our site", () => {
    expect(safeNextPath("/account?tab=roles")).toBe("/account?tab=roles");
  });

  it("falls back for missing or external targets", () => {
    expect(safeNextPath(null)).toBe("/dashboard");
    expect(safeNextPath("https://evil.example")).toBe("/dashboard");
    expect(safeNextPath("//evil.example")).toBe("/dashboard");
    expect(safeNextPath("/\\evil.example")).toBe("/dashboard");
    expect(safeNextPath("", "/")).toBe("/");
  });
});
