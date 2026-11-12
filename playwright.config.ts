import { defineConfig } from "@playwright/test";

// API tests run against the real server, started here on its own port with its own database.
// Set BASE_URL to test a server you already started (for example, a deployed one).
const PORT = Number(process.env.API_TEST_PORT ?? 3100);
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;
const TEST_DB = "data/api-tests.sqlite";

export default defineConfig({
  testDir: "tests/api",
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "reports/playwright", open: "never" }],
    ["json", { outputFile: "reports/playwright/results.json" }],
  ],
  use: {
    baseURL: BASE_URL,
  },
  projects: [{ name: "api" }],
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
