import { expect, test } from "@playwright/test";

import {
  inDays,
  seedAcceptedBooking,
  seedListedAircraft,
  seedVerifiedPilot,
  signUp,
  unique,
  withDb,
} from "./helpers";

// A pilot who has flown the aircraft before books it and it's accepted at once (BKG-4).
test.skip(!process.env.E2E_FULL, "set E2E_FULL=1 to run against a throwaway database");

test("a returning pilot's booking is accepted instantly", async ({ page, browser }) => {
  test.setTimeout(90_000);
  const id = unique();
  const letters = id
    .replace(/[^a-z]/g, "")
    .slice(0, 3)
    .toUpperCase()
    .padEnd(3, "X");
  const ownerEmail = `owner-i-${id}@example.com`;
  const pilotEmail = `pilot-i-${id}@example.com`;
  const ownerContext = await browser.newContext();
  await signUp(await ownerContext.newPage(), `Owner ${id}`, ownerEmail);
  await ownerContext.close();
  const aircraftId = await seedListedAircraft(ownerEmail, `LZ-I${letters}`);
  await signUp(page, `Pilot ${id}`, pilotEmail);
  await seedVerifiedPilot(pilotEmail);
  // An earlier rental, completed; then the owner switches instant booking on.
  const earlier = await seedAcceptedBooking(aircraftId, pilotEmail);
  await withDb(async (sql) => {
    await sql`update bookings set status = 'completed' where id = ${earlier}`;
    await sql`insert into rental_requirements (aircraft_id, instant_booking)
      values (${aircraftId}, true)`;
  });

  const day = inDays(20);
  await page.goto(`/aircraft/${aircraftId}/book`);
  await page.getByLabel("From").fill(`${day}T10:00`);
  await page.getByLabel("Until").fill(`${day}T13:00`);
  await page.getByLabel("Planned flight time (h)").fill("1.5");
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page).toHaveURL(/\/bookings\/[0-9a-f-]{36}$/);
  await expect(page.getByText("Accepted", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Booked instantly")).toBeVisible();
});
