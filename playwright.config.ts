import { defineConfig, devices } from "@playwright/test";

/**
 * The e2e suite drives the real thing: the Next app, the Python scorer, and a
 * seeded database, wired together exactly as in development. `pnpm dev` starts
 * both servers via concurrently; Playwright waits for the app to answer.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
