import { expect, test } from "@playwright/test";

// Needs airports in the database: npm run airports:import -- --file tests/fixtures/airports.csv
test.skip(!process.env.E2E_FULL, "set E2E_FULL=1 with imported test airports");

test("airport search ranks exact codes first and finds small airfields by name", async ({
  request,
}) => {
  const search = async (q: string) =>
    (
      (await (await request.get(`/api/airports?q=${encodeURIComponent(q)}`)).json()) as {
        results: { ident: string; code: string; name: string }[];
      }
    ).results;

  expect((await search("lbsf"))[0]?.ident).toBe("LBSF");
  expect((await search("SOF"))[0]?.ident).toBe("LBSF"); // IATA code
  expect((await search("zagortsi"))[0]).toMatchObject({ ident: "BG-0004", code: "BG-0004" });
  expect(await search("a")).toEqual([]); // too short
  expect(await search("heliport")).toEqual([]); // heliports are not imported
});

test("the airport picker works with the keyboard", async ({ page }) => {
  const email = `kb-${Date.now()}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Keyboard Pilot");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("blue-skies-2026");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/welcome$/);

  await page.goto("/account");
  const picker = page.getByRole("combobox", { name: "Home airfield" });
  await picker.fill("plovdiv");
  await expect(page.getByRole("option").first()).toContainText("LBPD");
  await picker.press("ArrowDown");
  await picker.press("Enter"); // picks the airport, doesn't submit the form
  await expect(picker).toHaveValue("LBPD – Plovdiv International Airport");

  // Typing without choosing keeps the previous airport
  await picker.fill("nothing-matches-this");
  await expect(page.getByText("No airfields found")).toBeVisible();
  await picker.press("Escape");
  await expect(picker).toHaveValue("LBPD – Plovdiv International Airport");

  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Profile saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Home airfield" })).toHaveValue(
    "LBPD – Plovdiv International Airport",
  );
});
