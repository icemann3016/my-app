import { expect, test } from "@playwright/test";

import { inDays, seedListedAircraft, seedVerifiedPilot, signUp, unique } from "./helpers";

// A verified pilot requests a listed aircraft → the owner sees the request and that the pilot
// meets the requirements → the same time can't be booked twice (BKG-1, BKG-2, BKG-5).
test.skip(!process.env.E2E_FULL, "set E2E_FULL=1 to run against a throwaway database");

test("a pilot requests a booking and the owner sees it", async ({ page, browser }) => {
  test.setTimeout(90_000);
  const id = unique();
  const letters = id
    .replace(/[^a-z]/g, "")
    .slice(0, 3)
    .toUpperCase()
    .padEnd(3, "X");
  const registration = `LZ-B${letters}`;
  const ownerEmail = `owner-b-${id}@example.com`;
  const pilotEmail = `pilot-b-${id}@example.com`;

  const ownerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  await signUp(owner, `Owner ${id}`, ownerEmail);
  const aircraftId = await seedListedAircraft(ownerEmail, registration);
  await signUp(page, `Pilot ${id}`, pilotEmail);
  await seedVerifiedPilot(pilotEmail);

  // 1. The pilot opens the aircraft and fills in the request
  const day = inDays(20);
  await page.goto(`/aircraft/${aircraftId}`);
  await expect(page.getByText("You meet the requirements.")).toBeVisible();
  await page.getByRole("link", { name: "Request booking" }).click();
  await page.getByLabel("From").fill(`${day}T10:00`);
  await page.getByLabel("Until").fill(`${day}T13:00`);
  await page.getByLabel("Passengers").fill("3");
  await page.getByLabel("Planned flight time (h)").fill("1.5");
  await expect(page.getByText("€270.00")).toBeVisible();
  await page.getByLabel("Message to the owner").fill("Local flight around Sofia.");
  await page.getByRole("button", { name: "Send request" }).click();

  // 2. The booking page shows the request, held for the owner's answer
  await expect(page).toHaveURL(/\/bookings\/[0-9a-f-]{36}$/);
  await expect(page.getByText("Requested", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Waiting for the owner/)).toBeVisible();
  const bookingUrl = new URL(page.url()).pathname;

  // 3. The same time can't be requested twice
  await page.goto(`/aircraft/${aircraftId}/book`);
  await page.getByLabel("From").fill(`${day}T12:00`);
  await page.getByLabel("Until").fill(`${day}T14:00`);
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText("That time isn't free any more.")).toBeVisible();

  // 4. The owner sees it, with a yes/no on the requirements (never the pilot's documents), and
  // suggests another time
  await owner.goto("/bookings");
  await expect(owner.getByRole("heading", { name: "For my aircraft" })).toBeVisible();
  await owner.getByRole("link", { name: new RegExp(registration) }).click();
  await expect(owner).toHaveURL(new RegExp(`${bookingUrl}$`));
  await expect(owner.getByText("The pilot meets your requirements for this flight.")).toBeVisible();
  await expect(owner.getByText("Local flight around Sofia.")).toBeVisible();
  await owner.getByRole("button", { name: "Suggest another time" }).click();
  await owner.getByLabel("From").fill(`${day}T15:00`);
  await owner.getByLabel("Until").fill(`${day}T17:00`);
  await owner.getByRole("button", { name: "Decline and suggest" }).click();
  await expect(owner.getByText(/You declined and suggested/)).toBeVisible();

  // 5. The pilot requests the suggested time with one tap; the owner accepts
  await page.goto(bookingUrl);
  await expect(page.getByText(/The owner can't do this time but suggests/)).toBeVisible();
  await page.getByRole("link", { name: "Request this time" }).click();
  await expect(page.getByLabel("From")).toHaveValue(`${day}T15:00`);
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page).toHaveURL(/\/bookings\/[0-9a-f-]{36}$/);
  const secondUrl = new URL(page.url()).pathname;

  await owner.goto(secondUrl);
  await owner.getByRole("button", { name: "Accept" }).click();
  await expect(owner.getByText("Accepted", { exact: true }).first()).toBeVisible();
  await ownerContext.close();
  await page.reload();
  await expect(page.getByText("Accepted", { exact: true }).first()).toBeVisible();

  // 6. The pilot cancels in time (20 days ahead: not late), giving a reason
  await page.getByRole("button", { name: "Cancel booking" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/free cancellation up to 3 days before/)).toBeVisible();
  await dialog.getByLabel("Reason (the other side sees it)").fill("Plans changed");
  await dialog.getByRole("button", { name: "Cancel booking" }).click();
  await expect(page.getByText("Cancelled by the pilot: Plans changed")).toBeVisible();
});
