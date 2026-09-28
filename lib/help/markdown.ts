// A small Markdown parser for the help articles in content/help (our own trusted files): headings,
// paragraphs, lists, tables, quotes, rules, code and inline bold, italics, code and links. It
// returns plain data; components/help/markdown.tsx turns it into React elements (never raw HTML).

export type Inline =
  | { type: "text"; text: string }
  | { type: "strong"; children: Inline[] }
  | { type: "em"; children: Inline[] }
  | { type: "code"; text: string }
  | { type: "link"; href: string; children: Inline[] };

export type Block =
  | { type: "heading"; level: 1 | 2 | 3; id: string; children: Inline[]; text: string }
  | { type: "paragraph"; children: Inline[] }
  | { type: "list"; ordered: boolean; items: Inline[][] }
  | { type: "table"; header: Inline[][]; rows: Inline[][][] }
  | { type: "quote"; children: Inline[] }
  | { type: "code"; text: string }
  | { type: "rule" };

const INLINE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)\s]+\))|(\*[^*\s][^*]*\*)/;

/** Links may go to our own pages, anchors, https/http sites or email; anything else is text. */
export function safeHref(href: string): string | null {
  return /^(\/(?!\/)|#|https?:\/\/|mailto:)/i.test(href) ? href : null;
}

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let rest = text;
  while (rest) {
    const m = INLINE.exec(rest);
    if (!m) {
      out.push({ type: "text", text: rest });
      break;
    }
    if (m.index > 0) out.push({ type: "text", text: rest.slice(0, m.index) });
    const token = m[0];
    if (m[1]) out.push({ type: "code", text: token.slice(1, -1) });
    else if (m[2]) out.push({ type: "strong", children: parseInline(token.slice(2, -2)) });
    else if (m[4]) out.push({ type: "em", children: parseInline(token.slice(1, -1)) });
    else {
      const [, label, href] = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token)!;
      const safe = safeHref(href!);
      out.push(
        safe
          ? { type: "link", href: safe, children: parseInline(label!) }
          : { type: "text", text: label! },
      );
    }
    rest = rest.slice(m.index + token.length);
  }
  return out;
}

/** Heading id for anchors: lower case letters and digits of any script, joined by hyphens. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

export function plainText(inlines: Inline[]): string {
  return inlines
    .map((i) => (i.type === "text" || i.type === "code" ? i.text : plainText(i.children)))
    .join("");
}

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => parseInline(c.trim()));

const isListItem = (line: string) => /^(\s*)([-*]|\d+\.)\s+/.test(line);
const startsBlock = (line: string) =>
  /^(#{1,3}\s|>\s?|\||```|---\s*$)/.test(line) || isListItem(line);

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  const ids = new Map<string, number>();
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim()) {
      i += 1;
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      const children = parseInline(heading[2]!.trim());
      const text = plainText(children);
      let id = slugify(text);
      const seen = ids.get(id) ?? 0;
      ids.set(id, seen + 1);
      if (seen) id = `${id}-${seen + 1}`;
      blocks.push({ type: "heading", level: heading[1]!.length as 1 | 2 | 3, id, children, text });
      i += 1;
    } else if (/^---\s*$/.test(line)) {
      blocks.push({ type: "rule" });
      i += 1;
    } else if (line.startsWith("```")) {
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i]!.startsWith("```")) code.push(lines[i++]!);
      i += 1;
      blocks.push({ type: "code", text: code.join("\n") });
    } else if (line.startsWith(">")) {
      const text: string[] = [];
      while (i < lines.length && lines[i]!.startsWith(">")) {
        text.push(lines[i++]!.replace(/^>\s?/, ""));
      }
      blocks.push({ type: "quote", children: parseInline(text.join(" ")) });
    } else if (line.startsWith("|")) {
      const rows: string[] = [];
      while (i < lines.length && lines[i]!.startsWith("|")) rows.push(lines[i++]!);
      const [head, , ...body] = rows;
      blocks.push({ type: "table", header: cells(head!), rows: body.map(cells) });
    } else if (isListItem(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: string[] = [];
      while (i < lines.length && lines[i]!.trim()) {
        const current = lines[i]!;
        if (isListItem(current)) items.push(current.replace(/^\s*([-*]|\d+\.)\s+/, ""));
        else if (/^\s+/.test(current) && items.length)
          items[items.length - 1] += ` ${current.trim()}`;
        else break;
        i += 1;
      }
      blocks.push({ type: "list", ordered, items: items.map(parseInline) });
    } else {
      const text: string[] = [];
      while (
        i < lines.length &&
        lines[i]!.trim() &&
        (text.length === 0 || !startsBlock(lines[i]!))
      ) {
        text.push(lines[i++]!.trim());
      }
      blocks.push({ type: "paragraph", children: parseInline(text.join(" ")) });
    }
  }
  return blocks;
}
