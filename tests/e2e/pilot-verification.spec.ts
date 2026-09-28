import { execFileSync } from "node:child_process";
import path from "node:path";

import { expect, type Page, test } from "@playwright/test";

// Pilot adds a licence and medical → an admin verifies them → the pilot is verified and the
// public profile shows the licence (never the medical or the documents).
// Needs a throwaway database (E2E_FULL=1) and DATABASE_URL to grant the admin role.
test.skip(!process.env.E2E_FULL, "set E2E_FULL=1 to run against a throwaway database");

const PASSWORD = "blue-skies-2026";
const pdf = path.join(__dirname, "fixtures", "licence.pdf");
const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

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

test("a pilot's licence and medical are verified by an admin", async ({ page, browser }) => {
  const id = unique();
  const pilotName = `Pilot ${id}`;

  // 1. The pilot adds a licence and a medical
  await signUp(page, pilotName, `pilot-${id}@example.com`);
  await page.goto("/account/credentials");
  await page.getByRole("button", { name: "Switch on pilot role" }).click();

  await page.getByRole("button", { name: "Add licence" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Issuing country").selectOption("BG");
  await dialog.getByLabel("Licence number").fill("BG.FCL.PPL.12345");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog.getByText("Please upload a scan or photo.")).toBeVisible();
  await dialog.getByLabel("Scan or photo").setInputFiles(pdf);
  await expect(dialog.getByRole("link", { name: /licence\.pdf/ })).toBeVisible();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  const licence = page.getByRole("listitem").filter({ hasText: "BG.FCL.PPL.12345" });
  await expect(licence.getByText("Pending review")).toBeVisible();

  await page.getByRole("button", { name: "Add medical" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Issuing country").selectOption("BG");
  await dialog.getByLabel("Valid until").fill(inDays(200));
  await dialog.getByLabel("Scan or photo").setInputFiles(pdf);
  await expect(dialog.getByRole("link", { name: /licence\.pdf/ })).toBeVisible();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("2 items are waiting for review.")).toBeVisible();

  // 2. Documents are private: visitors get a 404
  const documentUrl = await licence.getByRole("link", { name: "Document" }).getAttribute("href");
  expect((await page.request.get(documentUrl!)).status()).toBe(200);
  const visitor = await browser.newContext();
  expect((await visitor.request.get(documentUrl!)).status()).toBe(404);
  await visitor.close();

  // 3. Another user can't see the queue or the document until they are made an admin
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  const adminEmail = `admin-${id}@example.com`;
  await signUp(admin, `Admin ${id}`, adminEmail);
  expect((await admin.goto("/admin/verifications"))?.status()).toBe(404);
  expect((await admin.request.get(documentUrl!)).status()).toBe(404);
  execFileSync("node", ["scripts/grant-admin.mjs", adminEmail], { stdio: "pipe" });

  await admin.goto("/admin/verifications");
  await admin.getByRole("link", { name: new RegExp(pilotName) }).click();
  await expect(admin.getByRole("heading", { level: 1 })).toHaveText(`Review ${pilotName}`);
  expect((await admin.request.get(documentUrl!)).status()).toBe(200); // logged as a view
  await admin.getByRole("button", { name: "Verify PPL(A)" }).click();
  await expect(admin.getByText("Verified. The pilot has been told.")).toBeVisible();
  await admin.getByRole("button", { name: "Verify Class 2 medical" }).click();
  await expect(admin.getByText("Verified. The pilot has been told.")).toHaveCount(2);
  await expect(admin.getByText("opened a document")).toBeVisible(); // audit log
  await adminContext.close();

  // 4. The pilot is verified; the public profile shows the licence but not the medical
  await page.reload();
  await expect(page.getByText("You're a verified pilot")).toBeVisible();
  await page.goto("/dashboard");
  await page.getByRole("link", { name: "see what others see" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(pilotName);
  await expect(page.getByText("PPL(A)")).toBeVisible();
  await expect(page.getByText(/medical/i)).toHaveCount(0);
});

test("the daily job needs its secret", async ({ request }) => {
  expect((await request.get("/api/cron/daily")).status()).toBe(401);
  const secret = process.env.CRON_SECRET;
  test.skip(!secret, "set CRON_SECRET to run the job");
  const res = await request.get("/api/cron/daily", {
    headers: { authorization: `Bearer ${secret}` },
  });
  expect(res.status()).toBe(200);
  expect(await res.json()).toMatchObject({ ok: true });
});
