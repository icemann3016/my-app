import { expect, test } from "@playwright/test";

import {
  seedAcceptedBooking,
  seedListedAircraft,
  seedVerifiedPilot,
  signUp,
  unique,
} from "./helpers";

// Weather warnings on a booking about to fly (decision 2026-09-27): shown to both sides, the
// pilot also learns that their own IR is missing. The weather API is a local stand-in.
test.skip(!process.env.E2E_FULL, "set E2E_FULL=1 to run against a throwaway database");

test("pilot and owner see weather below VFR minima", async ({ page, browser }) => {
  test.setTimeout(90_000);
  const id = unique();
  const letters = id
    .replace(/[^a-z]/g, "")
    .slice(0, 3)
    .toUpperCase()
    .padEnd(3, "X");
  const ownerEmail = `owner-w-${id}@example.com`;
  const pilotEmail = `pilot-w-${id}@example.com`;
  const ownerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  await signUp(owner, `Owner ${id}`, ownerEmail);
  const aircraftId = await seedListedAircraft(ownerEmail, `LZ-W${letters}`);
  await signUp(page, `Pilot ${id}`, pilotEmail);
  await seedVerifiedPilot(pilotEmail);
  const bookingId = await seedAcceptedBooking(aircraftId, pilotEmail);

  await page.goto(`/bookings/${bookingId}`);
  const card = page
    .getByRole("heading", { name: "Weather" })
    .locator("xpath=ancestor::*[@data-slot='card'][1]");
  await expect(card.getByText(/below VFR minima \(visibility under 5 km/)).toBeVisible();
  await expect(card.getByText("This aircraft isn't approved for IFR.")).toBeVisible();
  await expect(card.getByText(/You don't have a valid, verified instrument rating/)).toBeVisible();
  await expect(card.getByText(/METAR LBSF .* 2000 BR OVC005/)).toBeVisible();
  await expect(card.getByText(/Forecast .*: visibility 2,000 m, ceiling 500 ft/)).toBeVisible();

  // The owner sees the weather, but nothing about the pilot's ratings.
  await owner.goto(`/bookings/${bookingId}`);
  await expect(owner.getByText(/below VFR minima \(visibility under 5 km/)).toBeVisible();
  await expect(owner.getByText(/instrument rating/)).toHaveCount(0);
  await ownerContext.close();
});
