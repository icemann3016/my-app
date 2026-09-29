import { describe, expect, it } from "vitest";

import bg from "@/messages/bg.json";
import de from "@/messages/de.json";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import fr from "@/messages/fr.json";
import itMessages from "@/messages/it.json";

import { intlLocale, locales, resolveLocale } from "./config";

const catalogs: Record<string, object> = { bg, de, fr, it: itMessages, es };

describe("resolveLocale", () => {
  it("prefers the saved cookie", () => {
    expect(resolveLocale("bg", "en-US,en;q=0.9")).toBe("bg");
  });
  it("uses the browser language when nothing is saved", () => {
    expect(resolveLocale(undefined, "bg-BG,bg;q=0.9,en;q=0.8")).toBe("bg");
    expect(resolveLocale(undefined, "de-DE,en;q=0.5")).toBe("de");
    expect(resolveLocale(undefined, "pl-PL,pl;q=0.9")).toBe("en");
  });
  it("respects quality values and ignores unknown cookies", () => {
    expect(resolveLocale("xx", "en;q=0.4,bg;q=0.8")).toBe("bg");
    expect(resolveLocale("fr", "en")).toBe("fr");
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
  function leaves(obj: object, prefix = ""): [string, string][] {
    return Object.entries(obj).flatMap(([k, v]) =>
      typeof v === "object" && v !== null
        ? leaves(v, `${prefix}${k}.`)
        : [[`${prefix}${k}`, String(v)] as [string, string]],
    );
  }
  // Placeholders ({name}, {count, plural…}) and rich-text tags (<link>) must survive translation.
  function markers(text: string): string[] {
    const args = [...text.matchAll(/\{\s*([A-Za-z0-9_]+)\s*[,}]/g)].map((m) => `{${m[1]}}`);
    const tags = [...text.matchAll(/<\/?([A-Za-z0-9_]+)>/g)].map((m) => `<${m[1]}>`);
    return [...new Set([...args, ...tags])].sort();
  }
  it.each(Object.keys(catalogs))("%s has exactly the same keys as English", (locale) => {
    expect(keys(catalogs[locale]!).sort()).toEqual(keys(en).sort());
  });
  it.each(Object.keys(catalogs))("%s keeps every placeholder and tag", (locale) => {
    const other = new Map(leaves(catalogs[locale]!));
    for (const [key, text] of leaves(en)) {
      expect(markers(other.get(key) ?? ""), `${locale}: ${key}`).toEqual(markers(text));
    }
  });
  it("names every language and has a number format for it", () => {
    for (const l of locales) {
      expect(
        (en as { common: { languages: Record<string, string> } }).common.languages[l],
      ).toBeTruthy();
      expect(() => new Intl.NumberFormat(intlLocale(l))).not.toThrow();
    }
  });
});
