import { expect, test } from "@playwright/test";

// Needs GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET on the server (CI sets dummy values).
test.skip(!process.env.GOOGLE_CLIENT_ID, "Google sign-in not configured");

test("Continue with Google sends the visitor to Google's sign-in page", async ({ page }) => {
  // Don't actually load Google: capture where the browser is sent.
  let googleUrl: URL | undefined;
  await page.route("https://accounts.google.com/**", async (route) => {
    googleUrl = new URL(route.request().url());
    await route.fulfill({ status: 200, body: "google" });
  });

  await page.goto("/login");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect.poll(() => googleUrl?.hostname).toBe("accounts.google.com");
  expect(googleUrl?.searchParams.get("client_id")).toBe(process.env.GOOGLE_CLIENT_ID);
  expect(googleUrl?.searchParams.get("redirect_uri")).toMatch(/\/api\/auth\/callback\/google$/);
});

test("an existing account gets a clear explanation instead of 'link expired'", async ({ page }) => {
  await page.goto("/login?error=account_not_linked");
  await expect(page.getByText(/You already have an account with this email/)).toBeVisible();
  await expect(page.getByText(/expired/)).toHaveCount(0);
});

test("a logged-in user can connect Google from the account page", async ({ page }) => {
  test.skip(!process.env.E2E_FULL, "needs a database");
  let googleUrl: URL | undefined;
  await page.route("https://accounts.google.com/**", async (route) => {
    googleUrl = new URL(route.request().url());
    await route.fulfill({ status: 200, body: "google" });
  });

  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Linking Pilot");
  await page.getByLabel("Email").fill(`link-${Date.now()}@example.com`);
  await page.getByLabel("Password").fill("blue-skies-2026");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/account");
  await expect(page.getByText("Email and password")).toBeVisible();
  await page.getByRole("button", { name: "Connect Google" }).click();
  await expect.poll(() => googleUrl?.hostname).toBe("accounts.google.com");
  expect(googleUrl?.searchParams.get("redirect_uri")).toMatch(/\/api\/auth\/callback\/google$/);
});
