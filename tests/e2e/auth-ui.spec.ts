import { expect, test, type Page } from "@playwright/test";
import { PASSWORD, uniqueEmail } from "../support/helpers.js";
import { HomePage } from "./pages/home.page.js";
import { LoginPage } from "./pages/login.page.js";
import { RegisterPage } from "./pages/register.page.js";

// BDD-style browser tests for the login UI. Each describe is a Given, each nested describe is a When,
// and each test is a Then. These eight checks were first run as a scratch script during S2 and are
// carried over here (see SPEC.md, S6).

// Collects uncaught JavaScript errors on the page, so check 7 can assert there are none.
function trackPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test.describe("Login UI", () => {
  test.describe("Given a visitor on the register page", () => {
    test("When the password is too short, Then the server's message is shown and the page stays on /register", async ({
      page,
    }) => {
      const register = new RegisterPage(page);
      await register.goto();

      await register.register(uniqueEmail("weak"), "short");

      await register.expectError("password must be at least 8 characters");
      await expect(page).toHaveURL(/\/register$/);
    });

    test("When the registration is valid, Then the page redirects to /login?registered=1 with the notice", async ({
      page,
    }) => {
      const register = new RegisterPage(page);
      const login = new LoginPage(page);
      await register.goto();

      await register.register(uniqueEmail("new"), PASSWORD);

      await expect(page).toHaveURL(/\/login\?registered=1$/);
      await expect(login.notice).toBeVisible();
      await expect(login.notice).toHaveText("Account created. Log in with your new password.");
    });
  });

  test.describe("Given a registered account", () => {
    test("When the password is wrong, Then the login page shows 'invalid email or password'", async ({
      page,
    }) => {
      const email = uniqueEmail("wrong");
      const register = new RegisterPage(page);
      await register.goto();
      await register.registerAndWaitForRedirect(email, PASSWORD);

      const login = new LoginPage(page);
      await login.logIn(email, "WrongPass1");

      await login.expectError("invalid email or password");
    });

    test("When the correct password is entered, Then the home page shows the signed-in email", async ({
      page,
    }) => {
      const email = uniqueEmail("in");
      const register = new RegisterPage(page);
      await register.goto();
      await register.registerAndWaitForRedirect(email, PASSWORD);

      const login = new LoginPage(page);
      await login.logIn(email, PASSWORD);

      const home = new HomePage(page);
      await expect(page).toHaveURL(/\/$/);
      await expect(home.signedIn).toBeVisible();
      await expect(home.userEmail).toHaveText(email.toLowerCase());
    });

    test("When the user logs out, Then the home page returns to the signed-out view", async ({
      page,
    }) => {
      const email = uniqueEmail("out");
      const register = new RegisterPage(page);
      await register.goto();
      await register.registerAndWaitForRedirect(email, PASSWORD);
      await new LoginPage(page).logIn(email, PASSWORD);

      const home = new HomePage(page);
      await expect(home.signedIn).toBeVisible();
      await home.logOut();

      await expect(home.signedOut).toBeVisible();
      await expect(home.signedIn).toBeHidden();
    });
  });

  test.describe("Given an error message that contains markup", () => {
    // The real API never echoes input in its messages, so this test mocks the response to
    // send hostile text. That way the page's display code is what gets checked.
    const HOSTILE_MESSAGE = "<img src=x onerror=window.__pwned=1><b>bold</b>";

    test("When the form shows the error, Then the markup is displayed as text and does not run", async ({
      page,
    }) => {
      await page.route("**/api/auth/login", (route) =>
        route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ error: HOSTILE_MESSAGE }),
        }),
      );
      const login = new LoginPage(page);
      await login.goto();

      await login.logIn("alice@example.com", "whatever1");

      await login.expectError(HOSTILE_MESSAGE);
      expect(await page.evaluate(() => (window as { __pwned?: number }).__pwned)).toBeUndefined();
      await expect(page.locator("#login-form [role='alert'] img")).toHaveCount(0);
      await expect(page.locator("#login-form [role='alert'] b")).toHaveCount(0);
    });

    test("When the real API rejects a malformed email, Then the generic message is shown", async ({
      page,
    }) => {
      const login = new LoginPage(page);
      await login.goto();

      await login.logIn("<img src=x onerror=window.__pwned=1>@example.com", "whatever1");

      // One generic message for every failed login, so the response doesn't reveal which part
      // was wrong (the same rule the API tests check).
      await login.expectError("invalid email or password");
      expect(await page.evaluate(() => (window as { __pwned?: number }).__pwned)).toBeUndefined();
    });
  });

  test.describe("Given the browser flows above", () => {
    test("Then no uncaught JavaScript errors occur on the login, register, or home pages", async ({
      page,
    }) => {
      const errors = trackPageErrors(page);
      const email = uniqueEmail("errors");
      const register = new RegisterPage(page);
      const login = new LoginPage(page);
      const home = new HomePage(page);

      await register.goto();
      await register.registerAndWaitForRedirect(email, PASSWORD);
      await login.logIn(email, PASSWORD);
      await expect(home.signedIn).toBeVisible();
      await home.logOut();
      await expect(home.signedOut).toBeVisible();

      expect(errors).toEqual([]);
    });

    test("Then each project runs in the browser it is meant to", async ({
      page,
      browserName,
    }, testInfo) => {
      // "ui" is the installed Google Chrome. Bundled Chromium also reports "chromium", but its
      // brand list has no "Google Chrome", which is how this test tells them apart.
      const expected: Record<string, string> = {
        ui: "chromium",
        "ui-firefox": "firefox",
        "ui-webkit": "webkit",
        "ui-edge": "chromium",
      };
      expect(browserName).toBe(expected[testInfo.project.name]);

      await page.goto("/login");
      await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();

      const brandOf: Record<string, string> = {
        ui: "Google Chrome",
        "ui-edge": "Microsoft Edge",
      };
      const wantedBrand = brandOf[testInfo.project.name];
      if (wantedBrand) {
        const brands = await page.evaluate(() =>
          (
            navigator as { userAgentData?: { brands: { brand: string }[] } }
          ).userAgentData?.brands.map((b) => b.brand),
        );
        expect(brands).toContain(wantedBrand);
      }
    });
  });
});
