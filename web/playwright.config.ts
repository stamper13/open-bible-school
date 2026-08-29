import { defineConfig, devices } from "@playwright/test";

// Next refuses to run two dev servers from the same directory, so the suite
// reuses whatever is already on this port and only boots one when nothing is
// listening. Override the port with PLAYWRIGHT_PORT.
const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3000);
const PREVIEW_BASE_URL = process.env.PLAYWRIGHT_BASE_URL?.replace(/\/$/, "");
// Local dev must be "localhost", not 127.0.0.1: Next's dev-mode cross-origin protection
// refuses to hydrate the app when the host differs from the dev server's own,
// which silently leaves every page on its server-rendered loading state.
const LOCAL_BASE_URL = `http://localhost:${PORT}`;
const BASE_URL = PREVIEW_BASE_URL ?? LOCAL_BASE_URL;

export default defineConfig({
  testDir: "./tests/e2e",
  // These are read-only smoke checks; running them in parallel is safe.
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : [["list"]],
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },

  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } } },
  ],

  ...(PREVIEW_BASE_URL
    ? {}
    : {
        // Reuses an already-running dev server; starts one only if the port is free.
        webServer: {
          command: `npm run dev -- --port ${PORT}`,
          url: LOCAL_BASE_URL,
          reuseExistingServer: true,
          timeout: 120_000,
        },
      }),
});
