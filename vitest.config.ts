import { defineConfig } from "vitest/config";

// Two projects so each suite can run on its own:
//   npm run test:unit         -> fast, no HTTP or database
//   npm run test:integration  -> Express app plus an in-memory SQLite database
// Fail the run if a project has no tests, so an empty suite never looks green.
export default defineConfig({
  test: {
    passWithNoTests: false,
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
        },
      },
    ],
  },
});
