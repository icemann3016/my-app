import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseMarkdown } from "@/lib/help/markdown";
import { contentLocales } from "@/lib/i18n/config";

const PAGES = ["terms", "privacy", "cookies"];

describe("legal pages", () => {
  it.each(PAGES)("%s exists in every language with the same sections", (page) => {
    const sections = contentLocales.map((locale) => {
      const source = readFileSync(
        path.join(process.cwd(), "content", "legal", locale, `${page}.md`),
        "utf8",
      );
      const blocks = parseMarkdown(source);
      expect(blocks[0]).toMatchObject({ type: "heading", level: 1 });
      return blocks.filter((b) => b.type === "heading" && b.level === 2).length;
    });
    expect(new Set(sections).size).toBe(1);
  });
});
