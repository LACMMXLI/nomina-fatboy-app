import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: process.env.E2E_DATABASE_READY === "true"
    ? { command: "npm run dev", url: "http://127.0.0.1:3000/api/health", reuseExistingServer: true, timeout: 120_000 }
    : undefined,
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
