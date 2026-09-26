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
