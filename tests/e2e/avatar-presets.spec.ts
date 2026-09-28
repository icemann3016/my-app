import { expect, test } from "@playwright/test";

import { signUp, unique } from "./helpers";

// A ready-made avatar can be chosen instead of uploading a photo.
test.skip(!process.env.E2E_FULL, "set E2E_FULL=1 to run against a throwaway database");

test("a user picks a ready-made avatar", async ({ page }) => {
  const id = unique();
  await signUp(page, `Avatar ${id}`, `avatar-${id}@example.com`);
  await page.goto("/account");
  const jet = page.getByRole("button", { name: "Jet", exact: true });
  await jet.click();
  await expect(jet).toHaveAttribute("aria-pressed", "true");
  // The profile picture (72 px) now shows the jet.
  await expect(page.locator('main img[src*="/avatars/jet.svg"][width="72"]')).toBeVisible();
  // It's a picture, not a photo: the button still offers an upload.
  await expect(page.getByRole("button", { name: "Upload photo" })).toBeVisible();

  await page.getByRole("button", { name: "Glider", exact: true }).click();
  await expect(page.getByRole("button", { name: "Glider", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(jet).toHaveAttribute("aria-pressed", "false");
});
