import { expect, test } from "@playwright/test";

test("home page shows the hero and main actions", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Rent a plane. Fly more.");
  await expect(page.getByRole("link", { name: "Find an aircraft" }).first()).toBeVisible();
});

test("navigation reaches the search page", async ({ page, isMobile }) => {
  await page.goto("/");
  if (isMobile) {
    await page.getByRole("button", { name: "Open menu" }).click();
    await page
      .getByRole("navigation", { name: "Mobile" })
      .getByRole("link", { name: "Find aircraft" })
      .click();
  } else {
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Find aircraft" })
      .click();
  }
  await expect(page).toHaveURL(/\/search$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Find aircraft");
});

test("unknown pages show the 404 page", async ({ page }) => {
  const response = await page.goto("/does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Off the charts" })).toBeVisible();
});
