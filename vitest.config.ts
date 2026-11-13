import { defineConfig } from "vitest/config";

// Two projects so each suite can run on its own:
//   npm run test:unit         -> fast, no HTTP or database
//   npm run test:integration  -> Express app plus an in-memory SQLite database
// Fail the run if a project has no tests, so an empty suite never looks green.
export default defineConfig({
  test: {
    passWithNoTests: false,
    // Coverage is measured for the pure-logic modules that S3 covers (no HTTP, no database).
    coverage: {
      provider: "v8",
      include: [
        "src/auth/validation.ts",
        "src/auth/password.ts",
        "src/auth/tokens.ts",
        "src/config.ts",
      ],
      reporter: ["text", "html"],
      reportsDirectory: "reports/coverage",
    },
    projects: [
      {
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          // Most integration tests run bcrypt (about 0.5 s each at cost 12). Several of them in
          // parallel on a loaded machine can pass Vitest's 5 s default, so the whole project gets
          // more time. Individual tests can still override this.
          testTimeout: 30_000,
          // beforeEach and afterEach hooks also register accounts, so they need the same headroom.
          hookTimeout: 30_000,
        },
      },
      {
        test: {
          // Real Safari via Selenium. Needs safaridriver enabled (see the suite's header).
          name: "safari",
          include: ["tests/safari/**/*.test.ts"],
          environment: "node",
          testTimeout: 60_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
