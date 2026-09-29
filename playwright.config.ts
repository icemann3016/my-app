import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const WEATHER_PORT = 4555;
const isCI = !!process.env.CI;

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
