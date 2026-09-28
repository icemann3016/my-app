import { describe, expect, it } from "vitest";

import { parseInline, parseMarkdown, safeHref, slugify } from "./markdown";

describe("help markdown", () => {
  it("parses headings with unique ids, wrapped paragraphs and lists", () => {
    const blocks = parseMarkdown(
      "# Title\n\nFirst line\nsecond line.\n\n## Part\n\n- one\n  continued\n- two\n\n## Part\n\n1. a\n2. b\n",
    );
    expect(blocks.map((b) => b.type)).toEqual([
      "heading",
      "paragraph",
      "heading",
      "list",
      "heading",
      "list",
    ]);
    expect(blocks[1]).toEqual({
      type: "paragraph",
      children: [{ type: "text", text: "First line second line." }],
    });
    expect(blocks[3]).toMatchObject({
      ordered: false,
      items: [[{ type: "text", text: "one continued" }], [{ type: "text", text: "two" }]],
    });
    expect(blocks[4]).toMatchObject({ id: "part-2" });
    expect(blocks[5]).toMatchObject({ ordered: true });
  });

  it("parses tables and quotes", () => {
    const [table, quote] = parseMarkdown("| A | B |\n|---|---|\n| **x** | y |\n\n> note\n> more");
    expect(table).toMatchObject({
      type: "table",
      header: [[{ type: "text", text: "A" }], [{ type: "text", text: "B" }]],
      rows: [[[{ type: "strong" }], [{ type: "text", text: "y" }]]],
    });
    expect(quote).toEqual({ type: "quote", children: [{ type: "text", text: "note more" }] });
  });

  it("parses inline bold, italics, code and links", () => {
    expect(parseInline("a **b** *c* `d` [e](/help/x)")).toEqual([
      { type: "text", text: "a " },
      { type: "strong", children: [{ type: "text", text: "b" }] },
      { type: "text", text: " " },
      { type: "em", children: [{ type: "text", text: "c" }] },
      { type: "text", text: " " },
      { type: "code", text: "d" },
      { type: "text", text: " " },
      { type: "link", href: "/help/x", children: [{ type: "text", text: "e" }] },
    ]);
  });

  it("keeps unsafe links as plain text", () => {
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("//evil.example")).toBeNull();
    expect(parseInline("[x](javascript:alert(1))")[0]).toMatchObject({ type: "text" });
  });

  it("makes ids from any script", () => {
    expect(slugify("Пилотски документи")).toBe("пилотски-документи");
    expect(slugify("Sign up and log in")).toBe("sign-up-and-log-in");
  });
});
