import { expect, test } from "@playwright/test";

import {
  seedAcceptedBooking,
  seedListedAircraft,
  seedVerifiedPilot,
  signUp,
  unique,
} from "./helpers";

// The availability calendar: pick dates to request a booking, see what a day holds (UTC).
test.skip(!process.env.E2E_FULL, "set E2E_FULL=1 to run against a throwaway database");

const day = (n: number) => new RegExp(`^${n} [A-Za-z]+:`);

test("pick dates on the calendar and see who booked (owner)", async ({ page, browser }) => {
  test.setTimeout(90_000);
  const id = unique();
  const letters = id
    .replace(/[^a-z]/g, "")
    .slice(0, 3)
    .toUpperCase()
    .padEnd(3, "X");
  const ownerEmail = `owner-cal-${id}@example.com`;
  const pilotEmail = `pilot-cal-${id}@example.com`;
  const ownerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  await signUp(owner, `Owner ${id}`, ownerEmail);
  const aircraftId = await seedListedAircraft(ownerEmail, `LZ-C${letters}`);
  await signUp(page, `Pilot ${id}`, pilotEmail);
  await seedVerifiedPilot(pilotEmail);

  // 1. The pilot picks the 10th to the 12th of next month and requests a booking.
  const next = new Date();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const month = next.toISOString().slice(0, 7);
  await page.goto(`/aircraft/${aircraftId}?month=${month}`);
  await page.getByRole("button", { name: day(10) }).click();
  await expect(page.getByText(/now click the last day/)).toBeVisible();
  await page.getByRole("button", { name: day(12) }).click();
  await page.getByLabel(/^Until/).fill("15:30");
  await page.getByRole("button", { name: "Request booking" }).click();
  await expect(page).toHaveURL(/\/book\?from=/);
  await expect(page.getByLabel("From")).toHaveValue(`${month}-10T08:00`);
  await expect(page.getByLabel("Until")).toHaveValue(`${month}-12T15:30`);

  // 2. A booking today: pilots see it as a booking, the owner also sees who.
  await seedAcceptedBooking(aircraftId, pilotEmail);
  const today = new Date().getUTCDate();
  await page.goto(`/aircraft/${aircraftId}`);
  await page.getByRole("button", { name: day(today) }).hover();
  const tip = page.getByRole("tooltip");
  await expect(tip).toContainText("UTC");
  await expect(tip).toContainText("Booking");
  await expect(tip).not.toContainText(`Pilot ${id}`);

  await owner.goto(`/owner/aircraft/${aircraftId}/calendar`);
  await owner.getByRole("button", { name: day(today) }).hover();
  await expect(owner.getByRole("tooltip")).toContainText(`Pilot ${id}`);
  await ownerContext.close();
});
