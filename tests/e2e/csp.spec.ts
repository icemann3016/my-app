import { expect, test } from "@playwright/test";

// The Content-Security-Policy (proxy.ts, lib/csp.ts) must not block anything the app needs.
test("pages load without Content-Security-Policy violations", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (msg) => {
    if (
      /Content Security Policy|Refused to (load|execute|apply|connect|create)/i.test(msg.text())
    ) {
      violations.push(`${page.url()}: ${msg.text()}`);
    }
  });
  const response = await page.goto("/");
  const csp = response?.headers()["content-security-policy"] ?? "";
  expect(csp).toContain("'strict-dynamic'");
  expect(csp).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
  // Every script Next.js rendered carries this request's nonce.
  const nonce = csp.match(/'nonce-([A-Za-z0-9+/=]+)'/)![1];
  const scripts = await page.evaluate(() =>
    [...document.querySelectorAll("script")].map((s) => s.nonce),
  );
  expect(scripts.length).toBeGreaterThan(0);
  expect(scripts.every((n) => n === nonce)).toBe(true);
  for (const path of [
    "/login",
    "/signup",
    "/help",
    "/terms",
    "/search",
    "/search?airport=LBSF&view=map",
  ]) {
    await page.goto(path);
    // Let client scripts (and the map, which keeps loading tiles) start.
    await page.waitForTimeout(1500);
  }
  // Client-side navigation and forms still work (scripts ran).
  await page.goto("/help");
  await page
    .getByRole("link", { name: /Getting started/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/help\/getting-started/);
  expect(violations).toEqual([]);
});
