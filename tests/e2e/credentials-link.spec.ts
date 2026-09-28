import { expect, test } from "@playwright/test";

import { inDays, seedListedAircraft, signUp, unique } from "./helpers";

// A pilot without approved credentials is sent from the booking form to their credentials,
// which live in a tab under Account.
test.skip(!process.env.E2E_FULL, "set E2E_FULL=1 to run against a throwaway database");

test("a refused booking links to the pilot credentials tab", async ({ page, browser }) => {
  test.setTimeout(90_000);
  const id = unique();
  const letters = id
    .replace(/[^a-z]/g, "")
    .slice(0, 3)
    .toUpperCase()
    .padEnd(3, "X");
  const ownerEmail = `owner-c-${id}@example.com`;
  const ownerContext = await browser.newContext();
  await signUp(await ownerContext.newPage(), `Owner ${id}`, ownerEmail);
  const aircraftId = await seedListedAircraft(ownerEmail, `LZ-C${letters}`);
  await ownerContext.close();
  await signUp(page, `Pilot ${id}`, `pilot-c-${id}@example.com`);

  const day = inDays(20);
  await page.goto(`/aircraft/${aircraftId}/book`);
  await page.getByLabel("From").fill(`${day}T10:00`);
  await page.getByLabel("Until").fill(`${day}T13:00`);
  await page.getByLabel("Planned flight time (h)").fill("1.5");
  await page.getByRole("button", { name: "Send request" }).click();
  const link = page.getByRole("link", { name: "Go to your pilot credentials" });
  await expect(link).toBeVisible();
  await link.click();

  await expect(page).toHaveURL(/\/account\/credentials$/);
  const tabs = page.getByRole("navigation", { name: "Account sections" });
  await expect(tabs.getByRole("link", { name: "Pilot credentials" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await tabs.getByRole("link", { name: "General" }).click();
  await expect(page).toHaveURL(/\/account$/);

  // The old address still works (links in earlier reminder emails).
  await page.goto("/pilot");
  await expect(page).toHaveURL(/\/account\/credentials$/);
});
