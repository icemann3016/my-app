import { expect, test } from "@playwright/test";

import {
  seedAcceptedBooking,
  seedListedAircraft,
  seedVerifiedPilot,
  signUp,
  unique,
} from "./helpers";

// Pilot and owner message each other about a listing and a booking (MSG-1).
test.skip(!process.env.E2E_FULL, "set E2E_FULL=1 to run against a throwaway database");

test("a pilot asks the owner, who answers; booking conversations too", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  const id = unique();
  const letters = id
    .replace(/[^a-z]/g, "")
    .slice(0, 3)
    .toUpperCase()
    .padEnd(3, "X");
  const ownerEmail = `owner-m-${id}@example.com`;
  const pilotEmail = `pilot-m-${id}@example.com`;
  const ownerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  await signUp(owner, `Owner ${id}`, ownerEmail);
  const aircraftId = await seedListedAircraft(ownerEmail, `LZ-M${letters}`);
  await signUp(page, `Pilot ${id}`, pilotEmail);

  // An enquiry from the aircraft page.
  await page.goto(`/aircraft/${aircraftId}`);
  await page.getByRole("link", { name: "Ask the owner" }).click();
  await expect(page.getByRole("heading", { name: `Ask Owner ${id}` })).toBeVisible();
  await page.getByLabel("Your message").fill("Is it free next Saturday?");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Is it free next Saturday?")).toBeVisible();

  // The owner sees one unread conversation and answers.
  await owner.goto("/dashboard");
  await owner.getByRole("link", { name: "Messages (1 unread)" }).first().click();
  await owner.getByRole("link", { name: new RegExp(`Pilot ${id}`) }).click();
  await expect(owner.getByText("Is it free next Saturday?")).toBeVisible();
  await owner.getByLabel("Your message").fill("Yes, from 08:00 UTC.");
  await owner.getByRole("button", { name: "Send" }).click();
  await expect(owner.getByText("Yes, from 08:00 UTC.")).toBeVisible();
  await expect(owner.getByLabel("Your message")).toHaveValue("");

  await page.reload();
  await expect(page.getByText("Yes, from 08:00 UTC.")).toBeVisible();

  // Once there is a booking, it has its own conversation.
  await seedVerifiedPilot(pilotEmail);
  const bookingId = await seedAcceptedBooking(aircraftId, pilotEmail, 60 * 24);
  await page.goto(`/bookings/${bookingId}`);
  await page.getByRole("link", { name: "Message the owner" }).click();
  await expect(page.getByText("No messages yet. Say hello!")).toBeVisible();
  await page.getByLabel("Your message").fill("Where are the keys?");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Where are the keys?")).toBeVisible();

  await owner.goto("/messages");
  await expect(owner.getByText("Where are the keys?")).toBeVisible();
  await expect(owner.getByText("Yes, from 08:00 UTC.")).toBeVisible();
  await ownerContext.close();
});
