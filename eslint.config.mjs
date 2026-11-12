// ESLint flat config (ESLint 9+). Lints TypeScript and JavaScript.
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["node_modules", "dist", "reports", "coverage", "playwright-report", "test-results"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Allow unused parameters that start with "_". Express's error handler needs its
    // 4-argument signature even when it doesn't use every argument.
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Browser JavaScript (the front end) gets browser globals like `console` and `document`.
    files: ["**/*.js"],
    languageOptions: {
      globals: globals.browser,
    },
  },
);
