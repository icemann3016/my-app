import { execFileSync } from "node:child_process";
import path from "node:path";

import { expect, type Page, test } from "@playwright/test";

// An owner lists an aircraft step by step → uploads photos and documents → an admin verifies the
// ARC and insurance → the owner publishes it → visitors see the listing with its requirements,
// but never the documents. Needs a throwaway database (E2E_FULL=1) with the test airports.
test.skip(!process.env.E2E_FULL, "set E2E_FULL=1 to run against a throwaway database");

const PASSWORD = "blue-skies-2026";
const photo = path.join(__dirname, "fixtures", "aircraft.jpg");
const pdf = path.join(__dirname, "fixtures", "licence.pdf");
const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const letters = () =>
  Array.from({ length: 4 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join(
    "",
  );

function inDays(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function signUp(page: Page, name: string, email: string) {
  await page.goto("/signup");
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function addDocument(page: Page, kind: string, validUntil?: string) {
  await page.getByRole("button", { name: "Add document" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Document").selectOption({ label: kind });
  if (validUntil) await dialog.getByLabel("Valid until").fill(validUntil);
  await dialog.getByLabel("Scan or photo").setInputFiles(pdf);
  await expect(dialog.getByRole("link", { name: /licence\.pdf/ })).toBeVisible();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
}

test("an owner lists an aircraft and an admin verifies its documents", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  const id = unique();
  const registration = `LZ-${letters()}`;

  // 1. Switch on the owner role and start a listing
  await signUp(page, `Owner ${id}`, `owner-${id}@example.com`);
  await page.goto("/owner/aircraft");
  await page.getByRole("button", { name: "Switch on owner role" }).click();
  await page.getByRole("link", { name: "Add aircraft" }).click();
  await page.getByLabel("Registration").fill("LZ_ABC");
  await page.getByLabel("Manufacturer").fill("Cessna");
  await page.getByLabel("Model").fill("172S Skyhawk SP");
  await page.getByLabel("ICAO type designator").fill("c172");
  await page.getByLabel("Seats (including pilot)").fill("4");
  await page.getByLabel("Fuel burn (L/h)").fill("36");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page.getByText(/Enter the registration as on the aircraft/)).toBeVisible();
  await page.getByLabel("Registration").fill(registration.toLowerCase());
  await page.getByRole("button", { name: "Save and continue" }).click();

  // 2. Equipment, home base and pricing; the draft is saved at every step
  await expect(page).toHaveURL(/\/equipment$/);
  await page.getByLabel("Avionics").fill("Garmin G1000");
  await page.getByLabel("Night VFR").check();
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page).toHaveURL(/\/base$/);
  await page.getByRole("combobox", { name: "Home base" }).fill("LBSF");
  await page.getByRole("listbox").getByRole("option").first().click();
  await page.getByLabel("Description").fill("Well kept C172 with G1000.");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page).toHaveURL(/\/pricing$/);
  await page.getByLabel("Price per hour", { exact: true }).fill("185");
  await page.getByRole("button", { name: "Save and continue" }).click();

  // 3. Photos
  await expect(page).toHaveURL(/\/photos$/);
  await page.getByLabel("Choose photos").setInputFiles([photo, photo]);
  await expect(page.getByText("2 of 20 photos")).toBeVisible();
  const aircraftUrl = page.url().replace(/\/photos$/, "");
  const aircraftId = aircraftUrl.split("/").pop()!;

  // 4. Documents: ARC and insurance; it can't be listed before they're verified
  await page.getByRole("link", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/documents$/);
  await addDocument(page, "Airworthiness Review Certificate (ARC)", inDays(300));
  await addDocument(page, "Insurance certificate", inDays(200));
  await expect(page.getByText("Pending review")).toHaveCount(2);
  const documentUrl = await page
    .getByRole("listitem")
    .filter({ hasText: "Insurance certificate" })
    .getByRole("link", { name: /licence\.pdf/ })
    .getAttribute("href");

  // 5. Requirements, then the overview shows what's still missing
  await page.getByRole("link", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/requirements$/);
  await page.getByLabel("PPL(A)").check();
  await page.getByLabel("Minimum total hours").fill("100");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page).toHaveURL(aircraftUrl);
  await expect(page.getByRole("button", { name: "Publish listing" })).toBeDisabled();

  // Drafts and documents are private
  const visitor = await browser.newContext();
  expect((await visitor.request.get(`/aircraft/${aircraftId}`)).status()).toBe(404);
  expect((await visitor.request.get(documentUrl!)).status()).toBe(404);

  // 6. An admin verifies the ARC and insurance
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  const adminEmail = `admin-${id}@example.com`;
  await signUp(admin, `Admin ${id}`, adminEmail);
  execFileSync("node", ["scripts/grant-admin.mjs", adminEmail], { stdio: "pipe" });
  await admin.goto("/admin/verifications");
  await admin.getByRole("link", { name: new RegExp(registration) }).click();
  await expect(admin.getByRole("heading", { level: 1 })).toHaveText(`Review ${registration}`);
  await admin
    .getByRole("button", { name: "Verify Airworthiness Review Certificate (ARC)" })
    .click();
  await expect(admin.getByText("Verified. The owner has been told.")).toBeVisible();
  await admin.getByRole("button", { name: "Verify Insurance certificate" }).click();
  await expect(admin.getByText("Verified. The owner has been told.")).toHaveCount(2);
  await adminContext.close();

  // 7. The owner publishes the listing
  await page.reload();
  await page.getByRole("button", { name: "Publish listing" }).click();
  await expect(page.getByText("Your aircraft is listed.")).toBeVisible();

  // 8. Visitors see the listing and its requirements, but still not the documents
  const anon = await visitor.newPage();
  await anon.goto(`/aircraft/${aircraftId}`);
  await expect(anon.getByRole("heading", { level: 1 })).toHaveText("Cessna 172S Skyhawk SP");
  await expect(anon.getByText(registration)).toBeVisible();
  await expect(anon.getByText("Licence: PPL(A)")).toBeVisible();
  await expect(anon.getByText("At least 100 h total flight time")).toBeVisible();
  await expect(anon.getByText("€185/h")).toBeVisible();
  expect((await anon.request.get(documentUrl!)).status()).toBe(404);
  await visitor.close();

  // 9. The owner blocks time; search only finds the aircraft when it's free (M5)
  const day = inDays(2);
  await page.goto(`${aircraftUrl}/calendar`);
  await page.getByLabel("Type").selectOption("maintenance");
  await page.getByLabel("From").fill(`${day}T10:00`);
  await page.getByLabel("Until").fill(`${day}T12:00`);
  await page.getByRole("button", { name: "Block time" }).last().click();
  await expect(page.getByText("Added to the calendar.")).toBeVisible();
  await page.getByLabel("From").fill(`${day}T11:00`);
  await page.getByLabel("Until").fill(`${day}T13:00`);
  await page.getByRole("button", { name: "Block time" }).last().click();
  await expect(page.getByText("This overlaps something already in the calendar.")).toBeVisible();

  const searcher = await browser.newContext();
  const search = await searcher.newPage();
  const searchUrl = (from: string, to: string) =>
    `/search?airport=LBSF&radius=25&from=${day}T${from}&to=${day}T${to}`;
  await search.goto(searchUrl("10:30", "11:30"));
  await expect(search.getByRole("heading", { level: 1 })).toHaveText("Find aircraft");
  await expect(search.getByText(registration)).toHaveCount(0);
  await search.goto(searchUrl("13:00", "15:00"));
  await expect(search.getByText(registration)).toBeVisible();
  await search
    .getByRole("listitem")
    .filter({ hasText: registration })
    .getByRole("link", { name: "Cessna 172S Skyhawk SP" })
    .click();
  await expect(search).toHaveURL(new RegExp(`/aircraft/${aircraftId}\\?`));
  await expect(search.getByText(/^Free /)).toBeVisible();
  await expect(search.getByText("Log in to see whether you meet the requirements")).toBeVisible();
  await searcher.close();

  // 10. Pausing hides it again
  await page.goto("/owner/aircraft");
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByText("Paused. Pilots can't see it for now.")).toBeVisible();
  const later = await browser.newContext();
  expect((await later.request.get(`/aircraft/${aircraftId}`)).status()).toBe(404);
  await later.close();
});
