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
