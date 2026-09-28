import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";

import { parseMarkdown } from "@/lib/help/markdown";
import type { Locale } from "@/lib/i18n/config";

// Terms, privacy and cookie pages (Req. §7, §9): Markdown in content/legal/<locale>/<page>.md.
// Drafts until a lawyer has reviewed them; keep both languages in step.
export const LEGAL_PAGES = ["terms", "privacy", "cookies"] as const;
export type LegalPage = (typeof LEGAL_PAGES)[number];

export const getLegalPage = cache(async (locale: Locale, page: LegalPage) => {
  const source = await readFile(
    path.join(process.cwd(), "content", "legal", locale, `${page}.md`),
    "utf8",
  );
  const [first, ...blocks] = parseMarkdown(source);
  return { title: first?.type === "heading" ? first.text : page, blocks };
});
