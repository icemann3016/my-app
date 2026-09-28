import { expect, test } from "@playwright/test";

// The knowledge base is public: browse, open an article, search (no account needed).
test("the help section can be browsed and searched", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Footer" })
    .getByRole("link", { name: "Help" })
    .click();
  await expect(page).toHaveURL(/\/help$/);
  await expect(page.getByRole("heading", { level: 1, name: "Help" })).toBeVisible();

  await page.getByRole("link", { name: /Flying: check-out, flight log and check-in/ }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Flying: check-out, flight log and check-in" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Check-in" })).toBeVisible();

  await page.goto("/help");
  await page.getByRole("searchbox", { name: "Search" }).fill("late cancellation");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/\/help\?q=late\+cancellation$/);
  await expect(page.getByRole("link", { name: /Finding and booking an aircraft/ })).toBeVisible();

  expect((await page.request.get("/help/does-not-exist")).status()).toBe(404);
});
