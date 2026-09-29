import { expect, test } from "@playwright/test";

import { signUp, unique } from "./helpers";

// People choose email and/or in-app notifications per kind (MSG-3).
test.skip(!process.env.E2E_FULL, "set E2E_FULL=1 to run against a throwaway database");

test("notification choices are saved", async ({ page }) => {
  const id = unique();
  await signUp(page, `Notify ${id}`, `notify-${id}@example.com`);
  await page.goto("/account");
  const bookingsEmail = page.getByRole("checkbox", { name: "Bookings: Email" });
  const messagesEmail = page.getByRole("checkbox", { name: "Messages: Email" });
  await expect(bookingsEmail).toBeChecked();
  await bookingsEmail.uncheck();
  await messagesEmail.uncheck();
  await page.getByRole("button", { name: "Save notifications" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Saved." }).first()).toBeVisible();
  await page.reload();
  await expect(bookingsEmail).not.toBeChecked();
  await expect(messagesEmail).not.toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Bookings: In the app" })).toBeChecked();
});
