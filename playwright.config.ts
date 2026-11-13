import { randomUUID } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

// One run = one app server + one database. Every project in this run (API and UI) shares that
// server, so they never fight over a port or a file. The database name includes a run ID, so a
// new run never reuses data from an earlier run.
//
// Two runs started at the same time need different ports: set API_TEST_PORT for one of them.
// Set BASE_URL to test a server you already started (for example, a deployed one).
const RUN_ID = (process.env.E2E_RUN_ID ??= `${Date.now()}-${randomUUID().slice(0, 8)}`);
const PORT = Number(process.env.API_TEST_PORT ?? 3100);
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;
const TEST_DB = `data/e2e-${RUN_ID}.sqlite`;

export default defineConfig({
  retries: process.env.CI ? 1 : 0,
  globalTeardown: "./tests/support/cleanup-database.ts",
  reporter: [
    // Prints each failure and each retry as it happens. With CI retries on, this keeps a test
    // that only passes on retry visible in the log instead of hiding it.
    ["failures"],
    ["html", { outputFolder: "reports/playwright", open: "never", onlyFailures: true }],
    ["json", { outputFile: "reports/playwright/results.json", onlyFailures: true }],
  ],
  use: {
    baseURL: BASE_URL,
  },
  projects: [
    // HTTP-level tests: no browser needed.
    { name: "api", testDir: "tests/api" },
    // Browser tests (S6): real Chromium, driving the login UI.
    { name: "ui", testDir: "tests/e2e", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: "node --import tsx src/index.ts",
        // The docs endpoint only exists outside production, so it doubles as a readiness check.
        url: `${BASE_URL}/api/openapi.json`,
        reuseExistingServer: false,
        timeout: 60_000,
        env: {
          NODE_ENV: "development",
          PORT: String(PORT),
          JWT_SECRET: "api-test-secret-at-least-32-characters-long",
          DATABASE_PATH: TEST_DB,
        },
      },
});
