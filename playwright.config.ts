import { generateKeyPairSync } from "node:crypto";

import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const WEATHER_PORT = 4555;
const isCI = !!process.env.CI;

// CI: dummy Apple and Facebook keys (Google's are in ci.yml) show the buttons, so the redirects
// to the providers can be tested. The Apple key is a throwaway made for this run.
if (isCI) {
  process.env.APPLE_CLIENT_ID ??= "eu.ownaplane.ci";
  process.env.APPLE_TEAM_ID ??= "CITEAM0000";
  process.env.APPLE_KEY_ID ??= "CIKEY00000";
  process.env.APPLE_PRIVATE_KEY ??= generateKeyPairSync("ec", { namedCurve: "P-256" })
    .privateKey.export({ type: "pkcs8", format: "pem" })
    .toString();
  process.env.FACEBOOK_CLIENT_ID ??= "ci-facebook-app";
  process.env.FACEBOOK_CLIENT_SECRET ??= "ci-facebook-secret";
}

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      // CI tests the production build; locally we reuse `npm run dev` if it's already running.
      command: isCI ? `npm run build && npm run start -- -p ${PORT}` : `npm run dev -- -p ${PORT}`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: !isCI,
      timeout: 180_000,
      // Weather comes from a local stand-in (tests/e2e/fixtures/weather-mock.mjs).
      env: { WEATHER_API_URL: `http://127.0.0.1:${WEATHER_PORT}/api/data` },
    },
    {
      command: `node tests/e2e/fixtures/weather-mock.mjs`,
      port: WEATHER_PORT,
      reuseExistingServer: !isCI,
      env: { WEATHER_MOCK_PORT: String(WEATHER_PORT) },
    },
  ],
});
