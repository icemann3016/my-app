import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";

import { PASSWORD, seedListedAircraft, signUp, unique } from "./helpers";

// A member reports a listing; an admin unlists it and suspends the owner, who can no longer
// log in; everything is in the audit log (ADM-2…4).
test.skip(!process.env.E2E_FULL, "set E2E_FULL=1 to run against a throwaway database");

test("an admin handles a report: unlist, suspend, audit log", async ({ page, browser }) => {
  test.setTimeout(90_000);
  const id = unique();
  const letters = id
    .replace(/[^a-z]/g, "")
    .slice(0, 3)
    .toUpperCase()
    .padEnd(3, "X");
  const ownerEmail = `owner-a-${id}@example.com`;
  const adminEmail = `admin-a-${id}@example.com`;
  const ownerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  await signUp(owner, `Owner ${id}`, ownerEmail);
  const aircraftId = await seedListedAircraft(ownerEmail, `LZ-A${letters}`);

  // A member reports the listing.
  await signUp(page, `Member ${id}`, `member-a-${id}@example.com`);
  await page.goto(`/aircraft/${aircraftId}`);
  await page.getByRole("button", { name: "Report", exact: true }).click();
  await page.getByLabel("Reason").selectOption("misleading");
  await page.getByLabel("Details (optional)").fill("Photos are of another aircraft.");
  await page.getByRole("button", { name: "Send report" }).click();
  await expect(page.getByText("Thanks, we'll take a look.")).toBeVisible();

  // The admin sees it on the dashboard and in the queue.
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await signUp(admin, `Admin ${id}`, adminEmail);
  execFileSync("node", ["scripts/grant-admin.mjs", adminEmail], { stdio: "pipe" });
  await admin.goto("/admin");
  await expect(admin.getByRole("heading", { name: "Admin dashboard" })).toBeVisible();
  // No SENTRY_DSN in tests: the test button says so.
  await admin.getByRole("button", { name: "Send a test error" }).click();
  await expect(admin.getByRole("alert").filter({ hasText: "SENTRY_DSN isn't set" })).toBeVisible();
  await admin.getByRole("link", { name: /Open reports/ }).click();
  // Other tests may run at the same time: work on this test's report only.
  const card = admin.getByRole("listitem").filter({ hasText: `LZ-A${letters}` });
  await expect(card.getByText("Photos are of another aircraft.")).toBeVisible();
  await card.getByRole("button", { name: "Unlist aircraft" }).click();
  await admin.getByLabel("Reason (for the audit log)").fill("Misleading photos");
  await admin.getByRole("dialog").getByRole("button", { name: "Unlist aircraft" }).click();
  await expect(card).toHaveCount(0); // the report is resolved too

  // Suspend the owner from the members list.
  await admin.goto(`/admin/users?q=${encodeURIComponent(ownerEmail)}`);
  await admin.getByRole("button", { name: "Suspend member" }).click();
  await admin.getByRole("dialog").getByRole("button", { name: "Suspend member" }).click();
  await expect(admin.getByText("Member suspended.")).toBeVisible();

  await admin.goto("/admin/audit?q=aircraft");
  await expect(admin.getByText("Misleading photos").first()).toBeVisible();
  await adminContext.close();

  // The owner is logged out and can't log in again; the listing is gone.
  await owner.goto("/dashboard");
  await expect(owner).toHaveURL(/\/login/);
  await owner.getByLabel("Email").fill(ownerEmail);
  await owner.getByLabel("Password").fill(PASSWORD);
  await owner.getByRole("button", { name: "Log in" }).click();
  await expect(owner.getByText("This account is suspended.", { exact: false })).toBeVisible();
  await ownerContext.close();

  expect((await page.goto(`/aircraft/${aircraftId}`))?.status()).toBe(404);
});
