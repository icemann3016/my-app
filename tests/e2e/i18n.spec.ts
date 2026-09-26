import { expect, test } from "@playwright/test";

test("visitors can switch the language to Bulgarian and back", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Rent a plane. Fly more.");

  await page.getByLabel("Language").selectOption("bg");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Наеми самолет. Лети повече.");
  await expect(page.locator("html")).toHaveAttribute("lang", "bg");

  // The choice is remembered on other pages.
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Вход" })).toBeVisible();

  await page.getByLabel("Език").selectOption("en");
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
});

test.describe("with a Bulgarian browser", () => {
  test.use({ locale: "bg-BG" });

  test("shows Bulgarian by default", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: "Създайте акаунт" })).toBeVisible();
    await expect(page.getByLabel("Вашето име")).toBeVisible();
  });
});
