import { expect, type Page, test } from "@playwright/test";

import {
  seedCompletedBooking,
  seedListedAircraft,
  seedVerifiedPilot,
  signUp,
  unique,
} from "./helpers";

// Both sides review a completed booking; reviews stay hidden until both have (RAT-1…3).
test.skip(!process.env.E2E_FULL, "set E2E_FULL=1 to run against a throwaway database");

async function rate(page: Page, categories: string[], stars: number) {
  for (const name of categories) {
    await page
      .getByRole("group", { name })
      .getByRole("radio", { name: `${stars} stars` })
      .check({ force: true });
  }
}

test("pilot and owner review each other, double-blind", async ({ page, browser }) => {
  test.setTimeout(90_000);
  const id = unique();
  const letters = id
    .replace(/[^a-z]/g, "")
    .slice(0, 3)
    .toUpperCase()
    .padEnd(3, "X");
  const ownerEmail = `owner-r-${id}@example.com`;
  const pilotEmail = `pilot-r-${id}@example.com`;
  const ownerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  await signUp(owner, `Owner ${id}`, ownerEmail);
  const aircraftId = await seedListedAircraft(ownerEmail, `LZ-R${letters}`);
  await signUp(page, `Pilot ${id}`, pilotEmail);
  await seedVerifiedPilot(pilotEmail);
  const bookingId = await seedCompletedBooking(aircraftId, pilotEmail);

  // The pilot reviews first: saved, but hidden from everyone else.
  await page.goto(`/bookings/${bookingId}`);
  await expect(page.getByRole("heading", { name: "Write your review" })).toBeVisible();
  await page.getByRole("button", { name: "Publish review" }).click();
  await expect(page.getByText("Choose 1 to 5 stars.").first()).toBeVisible();
  await rate(page, ["Aircraft condition", "Communication", "Value"], 4);
  await page.getByLabel("Comment (optional)").fill("Lovely aircraft, clean and on time.");
  await page.getByRole("button", { name: "Publish review" }).click();
  await expect(page.getByRole("heading", { name: "Your review" })).toBeVisible();
  await expect(page.getByText(/Only you can see this until/)).toBeVisible();

  await owner.goto(`/aircraft/${aircraftId}`);
  await expect(owner.getByText("No reviews yet.")).toBeVisible();

  // The owner reviews too: both are published.
  await owner.goto(`/bookings/${bookingId}`);
  await rate(owner, ["Airmanship", "Punctuality", "Communication", "Condition returned"], 5);
  await owner.getByRole("button", { name: "Publish review" }).click();
  await expect(owner.getByRole("heading", { name: "The pilot's review of you" })).toBeVisible();
  await expect(owner.getByText("Lovely aircraft, clean and on time.")).toBeVisible();

  await owner.goto(`/aircraft/${aircraftId}`);
  await expect(owner.getByRole("heading", { name: "Reviews" })).toBeVisible();
  await expect(owner.getByText("Lovely aircraft, clean and on time.")).toBeVisible();
  await expect(owner.getByText("4.0 (1 review)")).toBeVisible();

  // The pilot's public profile shows the owner's review and the new pilot rating.
  await owner.goto(`/bookings/${bookingId}`);
  await owner
    .getByRole("link", { name: `Pilot ${id}` })
    .first()
    .click();
  await expect(owner.getByRole("heading", { name: "Reviews as a pilot" })).toBeVisible();
  await expect(owner.getByText("(1) · as pilot")).toBeVisible();
  await ownerContext.close();

  await page.reload();
  await expect(page.getByRole("heading", { name: "The owner's review of you" })).toBeVisible();
});
