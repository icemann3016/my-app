import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

// Full journey with a real database: sign up → edit profile → photo → role → log out → log in.
// Creates a new user each run, so it only runs when E2E_FULL=1 (set in CI with a throwaway DB).
test.skip(!process.env.E2E_FULL, "set E2E_FULL=1 to run against a throwaway database");

test("a new pilot can sign up, set up their profile and log back in", async ({ page }) => {
  const email = `pilot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  const password = "blue-skies-2026";

  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Test Pilot");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Welcome, Test");

  // Profile
  await page.goto("/account");
  await page.getByLabel("Home airfield (ICAO)").fill("lbsf");
  await page.getByLabel("About you").fill("PPL(A), 120 hours on C172.");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Profile saved.")).toBeVisible();

  // Photo
  await page
    .getByLabel("Choose profile photo")
    .setInputFiles(path.join(__dirname, "fixtures", "avatar.png"));
  await expect(page.getByRole("button", { name: "Change photo" })).toBeVisible();

  // Role
  await page.getByRole("button", { name: "Switch on: I'm a pilot" }).click();
  await expect(page.getByRole("button", { name: "Switch off: I'm a pilot" })).toBeVisible();

  // Public profile shows it all
  await page.getByRole("link", { name: /View public profile/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Test Pilot");
  await expect(page.getByText("LBSF")).toBeVisible();
  await expect(page.getByText("Pilot", { exact: true })).toBeVisible();
  await expect(page.locator("main img")).toBeVisible();

  // Log out and back in
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Wrong email or password.")).toBeVisible();
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("a user can change language, download their data and delete their account", async ({
  page,
}) => {
  const email = `leaver-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  const password = "blue-skies-2026";

  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Leaving Pilot");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  // Preferences: switch to Bulgarian, the app follows
  await page.goto("/account");
  const preferences = page
    .locator("form")
    .filter({ has: page.getByRole("button", { name: "Save preferences" }) });
  await preferences.getByLabel("Language").selectOption("bg");
  await preferences.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByText("Предпочитанията са запазени.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Акаунт");

  // Download my data
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Изтегли моите данни" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^ownaplane-data-.*\.json$/);
  const exported = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(exported.account.email).toBe(email);
  expect(exported.settings.locale).toBe("bg");
  expect(JSON.stringify(exported)).not.toContain("password");

  // Delete account: wrong confirmation word first, then the real thing
  await page.getByRole("button", { name: "Изтрий акаунта" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Вашата парола").fill(password);
  await dialog.getByLabel(/Напишете ИЗТРИЙ/).fill("нещо");
  await dialog.getByRole("button", { name: "Изтрий акаунта ми" }).click();
  await expect(dialog.getByText("Напишете точно ИЗТРИЙ, за да потвърдите.")).toBeVisible();
  // Password fields are cleared after an error, so it has to be typed again.
  await dialog.getByLabel("Вашата парола").fill(password);
  await dialog.getByLabel(/Напишете ИЗТРИЙ/).fill("ИЗТРИЙ");
  await dialog.getByRole("button", { name: "Изтрий акаунта ми" }).click();

  await expect(page).toHaveURL(/\/\?deleted=1$/);
  await expect(page.getByText("Вашият акаунт и всички негови данни бяха изтрити.")).toBeVisible();

  // The account is really gone
  await page.goto("/login");
  await page.getByLabel("Имейл").fill(email);
  await page.getByLabel("Парола").fill(password);
  await page.getByRole("button", { name: "Вход" }).click();
  await expect(page.getByText("Грешен имейл или парола.")).toBeVisible();
});
