import { expect, test } from "@playwright/test";

import {
  seedAcceptedBooking,
  seedListedAircraft,
  seedVerifiedPilot,
  signUp,
  unique,
  userId,
  withDb,
} from "./helpers";

// The dashboard sums up both sides and links to where things are done.
test.skip(!process.env.E2E_FULL, "set E2E_FULL=1 to run against a throwaway database");

test("owner and pilot see their to-dos, flights and aircraft", async ({ page, browser }) => {
  test.setTimeout(90_000);
  const id = unique();
  const letters = id
    .replace(/[^a-z]/g, "")
    .slice(0, 3)
    .toUpperCase()
    .padEnd(3, "X");
  const registration = `LZ-D${letters}`;
  const ownerEmail = `owner-d-${id}@example.com`;
  const pilotEmail = `pilot-d-${id}@example.com`;
  const ownerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  await signUp(owner, `Owner ${id}`, ownerEmail);
  const aircraftId = await seedListedAircraft(ownerEmail, registration);
  await signUp(page, `Pilot ${id}`, pilotEmail);
  await seedVerifiedPilot(pilotEmail);
  await withDb(async (sql) => {
    const pilot = await userId(sql, pilotEmail);
    await sql`insert into user_roles (user_id, role) values (${pilot}, 'pilot')
      on conflict do nothing`;
  });
  // An accepted flight tomorrow, and a new request the owner still has to answer.
  await seedAcceptedBooking(aircraftId, pilotEmail, 60 * 24);
  await withDb(async (sql) => {
    const pilot = await userId(sql, pilotEmail);
    const from = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const to = new Date(Date.now() + 3 * 86_400_000 + 7_200_000).toISOString();
    await sql.begin(async (tx) => {
      await tx`select set_config('app.user_id', ${pilot}, true)`;
      await tx`select public.request_booking(${aircraftId}::uuid, tstzrange(${from}, ${to}),
        'LBSF', 'LBSF', '{}'::text[], 'local', 0, 1.5, null, 270)`;
    });
  });

  // Owner: the request is a to-do that opens the booking; the aircraft is listed.
  await owner.goto("/dashboard");
  const ownerCard = owner
    .getByRole("heading", { name: "As an owner" })
    .locator("xpath=ancestor::*[@data-slot='card'][1]");
  await expect(
    ownerCard.getByRole("link", { name: new RegExp(registration) }).first(),
  ).toBeVisible();
  await owner
    .getByRole("link", { name: new RegExp(`Answer the booking request for ${registration}`) })
    .click();
  await expect(owner).toHaveURL(/\/bookings\/[0-9a-f-]+$/);
  await expect(owner.getByRole("heading", { name: "Your answer" })).toBeVisible();
  await ownerContext.close();

  // Pilot: two upcoming flights, verified credentials, links to the details.
  await page.goto("/dashboard");
  const pilotCard = page
    .getByRole("heading", { name: "As a pilot" })
    .locator("xpath=ancestor::*[@data-slot='card'][1]");
  await expect(pilotCard.getByText("Verified pilot: licence and medical valid")).toBeVisible();
  await expect(pilotCard.getByRole("link", { name: /Upcoming flights/ })).toContainText("2");
  await pilotCard.getByRole("link", { name: "Pilot credentials" }).first().click();
  await expect(page).toHaveURL(/\/account\/credentials$/);
});
