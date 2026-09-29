import { expect, test } from "@playwright/test";

import { signUp, unique } from "./helpers";

// After sign-up: choose pilot / owner / both, then a guided list of steps; the dashboard shows
// the completion percentage and what's left (only what the user can do).
test.skip(!process.env.E2E_FULL, "set E2E_FULL=1 to run against a throwaway database");

test("a new member picks their roles and follows the setup guide", async ({ page }) => {
  const id = unique();
  await signUp(page, `Newbie ${id}`, `newbie-${id}@example.com`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "How will you use ownAplane?",
  );
  await page.getByRole("button", { name: /Both/ }).click();

  await expect(page.getByRole("heading", { name: "Set up your account" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pilot credentials" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your aircraft" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Add your pilot licence/ })).toBeVisible();
  await page.getByRole("link", { name: /Continue/ }).click();
  await expect(page).toHaveURL(/\/account$/);

  // The dashboard shows the percentage and opens to what's left.
  await page.goto("/dashboard");
  await expect(page.getByText(/Profile \d+% complete/)).toBeVisible();
  await page.getByText(/Profile \d+% complete/).click();
  await expect(page.getByRole("link", { name: "Add your first aircraft" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "As a pilot" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "As an owner" })).toBeVisible();

  // Changing your mind: pilot only.
  await page.goto("/welcome?step=roles");
  await page.getByRole("button", { name: /I'm a pilot/ }).click();
  await expect(page.getByRole("heading", { name: "Your aircraft" })).toHaveCount(0);
});
