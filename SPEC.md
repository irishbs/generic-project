# GenericProject: Specification

## Goal

**Phase A (now):** A demo that shows how to set up Playwright and automate a page, using a small full-stack app as the example. Built to demonstrate testing disciplines for SDET interview practice.

**Phase B (later, deferred):** A marketing tool that helps small companies test and automate their own small marketing sites.

## Decisions

| #   | Decision                                                                                                                                    | Status    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| D1  | Two phases: A is a Playwright demo; B is a marketing tool later.                                                                            | Confirmed |
| D2  | Audience is the author, practicing for SDET interviews.                                                                                     | Confirmed |
| D3  | Full mini app: frontend, backend, data store.                                                                                               | Confirmed |
| D4  | In scope: API, UI (E2E), unit + integration.                                                                                                | Confirmed |
| D5  | Security and performance both in Phase A.                                                                                                   | Confirmed |
| D6  | App domain: login + user accounts.                                                                                                          | Confirmed |
| D7  | TypeScript + Node/Express.                                                                                                                  | Confirmed |
| D8  | Done = runnable repo + CI + walkthrough.                                                                                                    | Confirmed |
| D9  | Reuse the `GenericProject` folder as repo root.                                                                                             | Confirmed |
| D10 | Phase B deferred until Phase A is done.                                                                                                     | Confirmed |
| D11 | Session: JWT in an httpOnly cookie.                                                                                                         | Confirmed |
| D12 | Reporting: each tool's built-in reports, collected into one folder.                                                                         | Confirmed |
| D13 | Self-healing: AI-driven.                                                                                                                    | Confirmed |
| D14 | Security scanner: OWASP ZAP, local only.                                                                                                    | Confirmed |
| D15 | AI healing proposes fixes; the author approves. Nothing auto-applies.                                                                       | Confirmed |
| D16 | AI backend: Claude API, using a key supplied by the author.                                                                                 | Confirmed |
| D17 | Hybrid approach: TDD for unit and integration tests; BDD-style Given/When/Then scenarios for API and UI acceptance tests.                   | Confirmed |
| D18 | API documented as an OpenAPI file (`openapi.yaml`), checked by tests.                                                                       | Confirmed |
| D19 | Swagger UI at `/api/docs/` and raw spec at `/api/openapi.json`, on outside production only (`NODE_ENV=production` turns them off).          | Confirmed |
| D20 | Password rules unchanged. The letter rule counts English letters (A–Z) only, so non-English letters alone do not satisfy it. Revisit later. | Confirmed |

Tool choices: Vitest (unit and integration), SQLite (data store, to be expanded in Phase B), Artillery (performance), README (walkthrough).

## Specs

Specs are listed in build order. Each is small and testable on its own. Each has a "Done when" line.

1. **S1: Auth API.** Express TypeScript endpoints for register, login, logout, and "who am I". JWT in an httpOnly cookie, with a revocation denylist for logout.
   - _Done when:_ register, login, logout, and me return documented status codes; passwords are stored hashed; logout revokes the token.
2. **S2: Login UI.** Register and login pages served by Express, replacing the placeholder `index.html`.
   - _Done when:_ a user can register and log in through the browser, and errors are shown.
3. **S3: Unit tests (Vitest).** Pure logic: password validation and JWT helpers.
   - _Done when:_ unit tests for password validation and JWT helpers pass in one command.
4. **S4: Integration tests (Vitest).** Backend plus SQLite, exercised together without a browser.
   - _Done when:_ integration tests cover each auth endpoint against a real SQLite database.
5. **S5: API tests (Playwright request fixture).** Status codes, response schemas, auth failures.
   - _Done when:_ API tests cover success and failure paths for every endpoint.
6. **S6: UI E2E tests (Playwright).** Register and login flows, with page objects.
   - _Done when:_ register and login flows pass in the browser using page objects.
   - _Carried over from S2 (required; implemented in `tests/e2e/auth-ui.spec.ts`, run by `npm run test:ui`):_ these eight browser checks were run once in Chrome as a scratch script. They are listed here because the scratch script is not in the repo.
     1. Weak password on register shows "password must be at least 8 characters" and the page stays on /register.
     2. A valid registration redirects to /login?registered=1 and shows "Account created. Log in with your new password."
     3. Wrong password on login shows "invalid email or password".
     4. Correct login redirects to / and the home page shows the signed-in email.
     5. Logout returns the home page to the signed-out view.
     6. An error message containing markup is shown as text, and the injected script does not run. The real API never echoes input, so this check mocks the response with network interception (Playwright `route`). A mutation test confirmed it fails if the page switches to `innerHTML`.
     7. The pages produce no uncaught JavaScript errors during the flows above.
     8. Register, login, and logout each run in Chrome. The tests use Playwright's bundled Chromium (`npx playwright install chromium`), set in the `ui` project.
7. **S12: Reporting.** Collects the Vitest, Playwright, Artillery, and ZAP reports into one output folder.
   - _Done when:_ one command produces a single folder containing every suite's report.
   - _Ordering note:_ S12 starts with Vitest and Playwright reports only. It is extended as S8 and S9 land.
8. **S13: Self-healing (AI-driven).** On a broken locator, the Claude API proposes a replacement and writes a diff. The author approves before anything changes.
   - _Done when:_ a deliberately broken locator produces a proposed diff, and nothing changes until the author approves.
9. **S7: Security tests.** Unauthorized access, password storage, JWT tampering and expiry, and XSS.
   - _Done when:_ tests cover each listed risk and pass against the running app.
10. **S8: Security scan (OWASP ZAP).** Scans the local app only. Runs in Docker.
    - _Done when:_ a ZAP scan of the local app completes and its report lands in the S12 output folder.
11. **S9: Performance tests (Artillery).** Load and response-time checks against the API.
    - _Done when:_ an Artillery run against the API completes and its report lands in the S12 output folder.
12. **S10: One-command runner.** Installs and runs every suite with a single command.
    - _Done when:_ a fresh clone runs all suites with one command.
13. **S11: CI (GitHub Actions).** Runs all suites on push and publishes reports.
    - _Done when:_ a push triggers all suites and uploads reports as artifacts.
14. **S14: Walkthrough (README).** One section per discipline.
    - _Done when:_ the README has one section per discipline and links to the test strategy.

## Added specs and extras (confirmed)

These were proposed in the PM review and kept by the author.

### Repo and project setup

- **S15: Repo setup.** `git init`, `.gitignore` (node_modules, reports, `.env`, SQLite files), `.env.example`, `package.json` scripts, ESLint, Prettier, `tsc` type-check. Build first.
  - _Done when:_ a fresh clone installs, lints, and type-checks with documented commands.
- **S16: Test data and isolation.** A fresh SQLite database per test run, seed helpers, and Playwright fixtures that create and clean up users.
  - _Done when:_ tests pass in any order and leave no data behind.
- **S17: Test strategy doc.** One page in the README: test pyramid, which spec covers which risk, and a requirements-to-tests traceability table.
  - _Done when:_ every spec S1 to S14 appears in the traceability table with its test file.
- **S18: Configurable target URL.** Base URL and credentials come from environment config, not hardcoded.
  - _Done when:_ changing one environment variable points every suite at a different URL.

### Optional Phase A additions (lower priority)

- **Accessibility tests.** Playwright with axe-core on the login and register pages.
- **Cross-browser and mobile.** Playwright projects for Chromium, Firefox, WebKit, and one mobile viewport.
- **Visual regression.** Playwright screenshot comparison on the login page.
- **Coverage threshold.** Vitest coverage with a minimum gate in CI.
- **Failure artifacts.** Playwright traces, screenshots, and video kept on failure, included in S12 reports.
- **Contract testing.** An OpenAPI file for the auth API, with API tests validated against it.
- **Negative and abuse cases.** Brute-force lockout or rate limiting, invalid input, and duplicate registration (feeds S7).
- **Network mocking.** Playwright route mocking to test UI error states without the backend.

## Risks

- **AI healing cost and nondeterminism.** Add a per-run call cap and an on/off flag.
- **ZAP in CI.** Docker is required and scans are slow; run on a schedule or on demand, not every push.
- **Artillery on shared CI runners.** Timings vary; use generous thresholds and treat results as trends.
- **Scope creep.** Full mini app plus six disciplines plus AI healing is large. Recommended build order: S15, S1, S2, S3, S4, S5, S6, then the rest.

## Phase B parking lot (do not build in Phase A)

- Password reset, roles and permissions, email verification.
- Multi-tenant data model and a hosted deployment.
- Pricing, packaging, and onboarding for small companies.
- Cross-site test generation for third-party marketing sites.

## Constraints and notes

- The Claude API key is read from an environment variable and never committed.
- OWASP ZAP runs in Docker, locally and in CI. Scans target the local app only.
- AI self-healing is excluded from the default test run and triggers only on failure. It costs money per call and is nondeterministic.
- The existing placeholder files (`index.html`, `app.js`, `style.css`) are replaced by S2.
