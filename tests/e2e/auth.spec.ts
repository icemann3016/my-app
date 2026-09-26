import { expect, test } from "@playwright/test";

// These tests never create accounts, so they are safe to run against any environment.

test("login page shows the form and helpful links", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("link", { name: "Forgot password?" })).toHaveAttribute(
    "href",
    "/forgot-password",
  );
  await expect(page.getByRole("link", { name: "Create an account" })).toBeVisible();
});

test("sign-up form requires the terms and a long enough password", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Test Pilot");
  await page.getByLabel("Email").fill("test@example.com");
  await page.getByLabel("Password").fill("short");
  await page.getByRole("button", { name: "Create account" }).click();

  // The browser blocks submission: still on the sign-up page, fields flagged invalid.
  await expect(page).toHaveURL(/\/signup$/);
  expect(
    await page.getByLabel("Password").evaluate((el: HTMLInputElement) => el.validity.valid),
  ).toBe(false);
  expect(
    await page.getByRole("checkbox").evaluate((el: HTMLInputElement) => el.validity.valid),
  ).toBe(false);
});

for (const path of ["/dashboard", "/account", "/account/password"]) {
  test(`${path} sends logged-out visitors to log in`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(`/login?next=${encodeURIComponent(path)}`);
  });
}

test("unknown public profiles show 404", async ({ page }) => {
  const response = await page.goto("/u/not-a-real-id");
  expect(response?.status()).toBe(404);
});
