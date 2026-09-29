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
  // The dropdown shows the language now in use, not the previous one.
  await expect(page.getByLabel("Language")).toHaveValue("en");
});

test("German, French, Italian and Spanish are available", async ({ page }) => {
  await page.goto("/");
  const titles = {
    de: "Flugzeug mieten. Mehr fliegen.",
    fr: "Louez un avion. Volez plus.",
    it: "Noleggia un aereo. Vola di più.",
    es: "Alquila un avión. Vuela más.",
  };
  for (const [locale, title] of Object.entries(titles)) {
    await page.locator("#language-switcher").selectOption(locale);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator("#language-switcher")).toHaveValue(locale);
  }
  // Legal pages fall back to English, with a note.
  await page.goto("/terms");
  await expect(page.getByText(/se muestra en inglés/)).toBeVisible();
  await page.locator("#language-switcher").selectOption("en");
});

test.describe("with a German browser", () => {
  test.use({ locale: "de-DE" });

  test("shows German by default", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Anmelden" })).toBeVisible();
  });
});

test.describe("with a Bulgarian browser", () => {
  test.use({ locale: "bg-BG" });

  test("shows Bulgarian by default", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: "Създайте акаунт" })).toBeVisible();
    await expect(page.getByLabel("Вашето име")).toBeVisible();
  });
});
