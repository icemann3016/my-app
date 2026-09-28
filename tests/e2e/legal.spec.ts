import { expect, test } from "@playwright/test";

// Terms, privacy and cookie pages are linked in the footer and at sign-up (Req. §7, §9).
test("legal pages are linked from the footer and the sign-up form", async ({ page }) => {
  await page.goto("/");
  const footer = page.getByRole("contentinfo");
  for (const [name, heading] of [
    ["Terms", "Terms of service"],
    ["Privacy", "Privacy policy"],
    ["Cookies", "Cookie policy"],
  ]) {
    await footer.getByRole("link", { name, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
    await expect(page.getByText(/^Draft:/)).toBeVisible();
  }
  await page.goto("/signup");
  await expect(page.getByRole("link", { name: /terms/i }).first()).toHaveAttribute(
    "href",
    "/terms",
  );
  await expect(page.getByRole("link", { name: /privacy/i }).first()).toHaveAttribute(
    "href",
    "/privacy",
  );
});
