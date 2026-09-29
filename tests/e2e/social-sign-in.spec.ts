import { expect, type Page, test } from "@playwright/test";

// Each provider's button appears only with its keys on the server (CI sets dummy values:
// Google in ci.yml, Apple and Facebook in playwright.config.ts).
const providers = [
  { name: "Google", id: "google", env: "GOOGLE_CLIENT_ID", host: "accounts.google.com" },
  { name: "Apple", id: "apple", env: "APPLE_CLIENT_ID", host: "appleid.apple.com" },
  { name: "Facebook", id: "facebook", env: "FACEBOOK_CLIENT_ID", host: "www.facebook.com" },
] as const;

/** Don't actually load the provider: capture where the browser is sent. */
async function captureRedirect(page: Page, host: string) {
  const sent: { url?: URL } = {};
  await page.route(`https://${host}/**`, async (route) => {
    sent.url = new URL(route.request().url());
    await route.fulfill({ status: 200, body: "provider" });
  });
  return sent;
}

for (const provider of providers) {
  test(`Continue with ${provider.name} sends the visitor to ${provider.name}`, async ({ page }) => {
    test.skip(!process.env[provider.env], `${provider.name} sign-in not configured`);
    const sent = await captureRedirect(page, provider.host);

    await page.goto("/login");
    await page.getByRole("button", { name: `Continue with ${provider.name}` }).click();
    await expect.poll(() => sent.url?.hostname).toBe(provider.host);
    expect(sent.url?.searchParams.get("client_id")).toBe(process.env[provider.env]);
    expect(sent.url?.searchParams.get("redirect_uri")).toMatch(
      new RegExp(`/api/auth/callback/${provider.id}$`),
    );
  });
}

test("Apple answers with a form post, as Sign in with Apple needs for name and email", async ({
  page,
}) => {
  test.skip(!process.env.APPLE_CLIENT_ID, "Apple sign-in not configured");
  const sent = await captureRedirect(page, "appleid.apple.com");
  await page.goto("/signup");
  await page.getByRole("button", { name: "Continue with Apple" }).click();
  await expect.poll(() => sent.url?.searchParams.get("response_mode")).toBe("form_post");
  expect(sent.url?.searchParams.get("scope")).toContain("email");
});

test("an existing account gets a clear explanation instead of 'link expired'", async ({ page }) => {
  await page.goto("/login?error=account_not_linked");
  await expect(page.getByText(/You already have an account with this email/)).toBeVisible();
  await expect(page.getByText(/expired/)).toHaveCount(0);
});

test("a social account without an email gets an explanation", async ({ page }) => {
  await page.goto("/login?error=email_not_found");
  await expect(page.getByText(/didn't get an email address/)).toBeVisible();
});

test("a logged-in user can connect Google, Apple or Facebook from the account page", async ({
  page,
}) => {
  test.skip(!process.env.E2E_FULL, "needs a database");
  const enabled = providers.filter((p) => process.env[p.env]);
  test.skip(enabled.length === 0, "no social sign-in configured");

  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Linking Pilot");
  await page.getByLabel("Email").fill(`link-${Date.now()}@example.com`);
  await page.getByLabel("Password").fill("blue-skies-2026");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/welcome$/);

  for (const provider of enabled) {
    const sent = await captureRedirect(page, provider.host);
    await page.goto("/account");
    await expect(page.getByText("Email and password")).toBeVisible();
    await page.getByRole("button", { name: `Connect ${provider.name}` }).click();
    await expect.poll(() => sent.url?.hostname).toBe(provider.host);
    expect(sent.url?.searchParams.get("redirect_uri")).toMatch(
      new RegExp(`/api/auth/callback/${provider.id}$`),
    );
  }
});
