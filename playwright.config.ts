import { defineConfig, devices } from "@playwright/test";

// API and browser tests run against the real server, started here on its own port with its own
// database. Set BASE_URL to test a server you already started (for example, a deployed one).
const PORT = Number(process.env.API_TEST_PORT ?? 3100);
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;
// One database file per port, so two suites running at once (on different ports) never share data.
const TEST_DB = `data/playwright-${PORT}.sqlite`;

export default defineConfig({
  retries: process.env.CI ? 1 : 0,
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
        // Delete the test database first, so every run starts empty (S16: test isolation).
        command: `rm -f ${TEST_DB} ${TEST_DB}-wal ${TEST_DB}-shm && node --import tsx src/index.ts`,
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
