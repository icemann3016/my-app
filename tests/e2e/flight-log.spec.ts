import { expect, test } from "@playwright/test";

import {
  seedAcceptedBooking,
  seedListedAircraft,
  seedVerifiedPilot,
  signUp,
  unique,
} from "./helpers";

// The pilot checks out, logs a leg and checks in → the owner confirms the flown time and the
// amount due (BKG-7, BKG-12).
test.skip(!process.env.E2E_FULL, "set E2E_FULL=1 to run against a throwaway database");

test("a pilot fills in the flight log and the owner confirms it", async ({ page, browser }) => {
  test.setTimeout(90_000);
  const id = unique();
  const letters = id
    .replace(/[^a-z]/g, "")
    .slice(0, 3)
    .toUpperCase()
    .padEnd(3, "X");
  const ownerEmail = `owner-l-${id}@example.com`;
  const pilotEmail = `pilot-l-${id}@example.com`;
  const ownerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  await signUp(owner, `Owner ${id}`, ownerEmail);
  const aircraftId = await seedListedAircraft(ownerEmail, `LZ-L${letters}`);
  await signUp(page, `Pilot ${id}`, pilotEmail);
  await seedVerifiedPilot(pilotEmail);
  const bookingId = await seedAcceptedBooking(aircraftId, pilotEmail);

  // 1. Check-out opens the log
  await page.goto(`/bookings/${bookingId}`);
  await page.getByRole("button", { name: "Check out" }).click();
  await expect(page).toHaveURL(new RegExp(`/bookings/${bookingId}/log$`));
  await expect(page.getByRole("heading", { name: "Flight log", level: 1 })).toBeVisible();
  await page.getByLabel("Hobbs", { exact: true }).fill("1000");
  await page.getByRole("button", { name: "Save check-out" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  // 2. One leg, times in local time; the amount follows the Hobbs meter
  await page.getByRole("button", { name: "Add leg" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox", { name: "To" }).fill("LBSF");
  await dialog.getByRole("listbox").getByRole("option").first().click();
  for (const [label, time] of [
    ["Block off", "10:00"],
    ["Engine start", "10:05"],
    ["Engine stop", "11:15"],
    ["Block on", "11:20"],
  ]) {
    await dialog.getByLabel(label, { exact: true }).fill(time);
  }
  await dialog.getByLabel("Hobbs start").fill("1000");
  await dialog.getByLabel("Hobbs end").fill("1001.2");
  await dialog.getByRole("button", { name: "Save leg" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("1. LBSF → LBSF")).toBeVisible();
  await expect(page.getByText("1 h 12 min")).toBeVisible();
  await expect(page.getByText("€216", { exact: true })).toBeVisible();

  // 3. Check-in: the pilot can't change it any more
  await page.getByRole("button", { name: "Check in and send to the owner" }).click();
  await expect(page.getByText("Sent. Waiting for the owner to confirm.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add leg" })).toHaveCount(0);

  // 4. The owner confirms; the booking is completed
  await owner.goto(`/bookings/${bookingId}`);
  await owner.getByRole("link", { name: "Flight log" }).click();
  await expect(owner.getByText("€216", { exact: true })).toBeVisible();
  await owner.getByRole("button", { name: "Confirm log and amount" }).click();
  await expect(owner.getByText(/· Confirmed$/)).toBeVisible();
  await owner.goto(`/bookings/${bookingId}`);
  await expect(owner.getByText("Completed", { exact: true }).first()).toBeVisible();
  await expect(owner.getByText("Flight log confirmed")).toBeVisible();
  await ownerContext.close();
});
