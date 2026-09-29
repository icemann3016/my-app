import { readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { contentLocales, locales } from "@/lib/i18n/config";
import { getHelpArticle, getHelpArticles, HELP_SLUGS, searchHelp } from "./articles";

const dir = path.join(process.cwd(), "content", "help");

describe("help articles", () => {
  it("has every article in every translated language, and nothing else", () => {
    for (const locale of contentLocales) {
      const files = readdirSync(path.join(dir, locale)).map((f) => f.replace(/\.md$/, ""));
      expect(files.sort()).toEqual([...HELP_SLUGS].sort());
    }
  });

  it("gives every article a title and a summary, and links only to existing articles", async () => {
    for (const locale of locales) {
      for (const article of await getHelpArticles(locale)) {
        expect(article.title, `${locale}/${article.slug}`).not.toBe(article.slug);
        expect(article.summary, `${locale}/${article.slug}`).not.toBe("");
        const source = JSON.stringify(article.blocks);
        for (const [, slug] of source.matchAll(/"href":"\/help\/([a-z-]+)"/g)) {
          expect(HELP_SLUGS, `${locale}/${article.slug} links to ${slug}`).toContain(slug);
        }
      }
    }
  });

  it("returns null for unknown articles and finds articles by words", async () => {
    expect(await getHelpArticle("en", "nope")).toBeNull();
    const all = await getHelpArticles("en");
    expect(searchHelp(all, "late cancellation").map((a) => a.slug)).toContain(
      "finding-and-booking",
    );
    expect(searchHelp(all, "")).toHaveLength(all.length);
    const bg = await getHelpArticles("bg");
    expect(searchHelp(bg, "дневник").length).toBeGreaterThan(0);
  });
});
