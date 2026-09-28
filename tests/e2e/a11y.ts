import { expect, type Page } from "@playwright/test";

/**
 * WCAG 2.1 AA basics we can check without extra tools (KAN-71): page language, one h1, a skip
 * link, labelled form fields, alt text on images, and a name for every button and link.
 * Returns the problems found, so a failing test lists them all.
 */
export async function a11yProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const problems: string[] = [];
    const visible = (el: Element) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      const style = getComputedStyle(el);
      return style.visibility !== "hidden" && style.display !== "none" && r.width + r.height > 0;
    };
    const describe = (el: Element) => el.outerHTML.slice(0, 120);
    const text = (el: Element | null) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
    const labelledBy = (el: Element) =>
      (el.getAttribute("aria-labelledby") ?? "")
        .split(/\s+/)
        .map((id) => text(document.getElementById(id)))
        .join(" ")
        .trim();
    const name = (el: Element) =>
      el.getAttribute("aria-label")?.trim() ||
      labelledBy(el) ||
      el.getAttribute("title")?.trim() ||
      text(el) ||
      [...el.querySelectorAll("img[alt]")]
        .map((i) => i.getAttribute("alt"))
        .join(" ")
        .trim();

    if (!document.documentElement.lang) problems.push("html has no lang");
    const h1s = [...document.querySelectorAll("h1")].filter(visible);
    if (h1s.length !== 1) problems.push(`expected one visible h1, found ${h1s.length}`);
    if (!document.querySelector('a[href="#main"]')) problems.push("no skip link");

    for (const el of document.querySelectorAll("input, select, textarea")) {
      const input = el as HTMLInputElement;
      if (input.type === "hidden" || (!visible(el) && !input.classList.contains("sr-only")))
        continue;
      const hasLabel =
        (input.id && document.querySelector(`label[for="${CSS.escape(input.id)}"]`)) ||
        el.closest("label") ||
        el.getAttribute("aria-label") ||
        labelledBy(el);
      if (!hasLabel) problems.push(`field without a label: ${describe(el)}`);
    }
    for (const img of document.querySelectorAll("img")) {
      if (!img.hasAttribute("alt")) problems.push(`image without alt: ${describe(img)}`);
    }
    for (const el of document.querySelectorAll("button, a[href], [role=button]")) {
      if (!visible(el)) continue;
      if (!name(el)) problems.push(`control without a name: ${describe(el)}`);
    }
    return problems;
  });
}

export async function expectAccessible(page: Page) {
  expect(await a11yProblems(page), page.url()).toEqual([]);
}
