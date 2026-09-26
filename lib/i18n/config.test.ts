import { describe, expect, it } from "vitest";

import bg from "@/messages/bg.json";
import en from "@/messages/en.json";

import { resolveLocale } from "./config";

describe("resolveLocale", () => {
  it("prefers the saved cookie", () => {
    expect(resolveLocale("bg", "en-US,en;q=0.9")).toBe("bg");
  });
  it("uses the browser language when nothing is saved", () => {
    expect(resolveLocale(undefined, "bg-BG,bg;q=0.9,en;q=0.8")).toBe("bg");
    expect(resolveLocale(undefined, "de-DE,en;q=0.5")).toBe("en");
  });
  it("respects quality values and ignores unknown cookies", () => {
    expect(resolveLocale("fr", "en;q=0.4,bg;q=0.8")).toBe("bg");
  });
  it("falls back to English", () => {
    expect(resolveLocale(undefined, null)).toBe("en");
  });
});

describe("translations", () => {
  function keys(obj: object, prefix = ""): string[] {
    return Object.entries(obj).flatMap(([k, v]) =>
      typeof v === "object" && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
    );
  }
  it("Bulgarian has exactly the same keys as English", () => {
    expect(keys(bg).sort()).toEqual(keys(en).sort());
  });
});
