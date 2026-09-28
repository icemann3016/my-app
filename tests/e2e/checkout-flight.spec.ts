import { expect, test } from "@playwright/test";

import {
  seedAcceptedBooking,
  seedListedAircraft,
  seedVerifiedPilot,
  signUp,
  unique,
  withDb,
} from "./helpers";

// The owner asks new pilots for a checkout flight and records it on the booking (BKG-10).
test.skip(!process.env.E2E_FULL, "set E2E_FULL=1 to run against a throwaway database");

test("the owner records a pilot's checkout flight", async ({ page, browser }) => {
  test.setTimeout(90_000);
  const id = unique();
  const letters = id
    .replace(/[^a-z]/g, "")
    .slice(0, 3)
    .toUpperCase()
    .padEnd(3, "X");
  const ownerEmail = `owner-k-${id}@example.com`;
  const pilotEmail = `pilot-k-${id}@example.com`;
  const ownerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  await signUp(owner, `Owner ${id}`, ownerEmail);
  const aircraftId = await seedListedAircraft(ownerEmail, `LZ-K${letters}`);
  await withDb(
    (sql) =>
      sql`insert into rental_requirements (aircraft_id, checkout_first_rental)
        values (${aircraftId}, true)`,
  );
  await signUp(page, `Pilot ${id}`, pilotEmail);
  await seedVerifiedPilot(pilotEmail);
  const bookingId = await seedAcceptedBooking(aircraftId, pilotEmail);

  await page.goto(`/bookings/${bookingId}`);
  await expect(page.getByText(/asks for a checkout flight with an instructor/)).toBeVisible();

  await owner.goto(`/bookings/${bookingId}`);
  await owner.getByLabel("Instructor (optional)").fill("FI Petrov");
  await owner.getByRole("button", { name: "Record checkout flight" }).click();
  await expect(owner.getByText(/Checkout flight on this aircraft recorded on/)).toBeVisible();
  await ownerContext.close();

  await page.reload();
  await expect(page.getByText(/recorded on .* · instructor FI Petrov/)).toBeVisible();
});
