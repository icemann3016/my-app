import { expect, test } from "@playwright/test";

import { seedListedAircraft, signUp, unique } from "./helpers";

// The map view shows one marker per airfield; its popup lists the aircraft there (SRC-3).
test.skip(!process.env.E2E_FULL, "set E2E_FULL=1 to run against a throwaway database");

test("search results show on the map", async ({ page }) => {
  test.setTimeout(60_000);
  const id = unique();
  const letters = id
    .replace(/[^a-z]/g, "")
    .slice(0, 3)
    .toUpperCase()
    .padEnd(3, "X");
  const registration = `LZ-M${letters}`;
  const email = `owner-m-${id}@example.com`;
  await signUp(page, `Owner ${id}`, email);
  await seedListedAircraft(email, registration);

  await page.goto("/search?airport=LBSF&view=map");
  await expect(page.getByRole("region", { name: "Map of the aircraft found" })).toBeVisible();
  const marker = page.getByRole("button", { name: /^LBSF: \d+ aircraft$/ });
  await marker.click();
  await expect(page.getByRole("link", { name: new RegExp(registration) })).toBeVisible();
});
