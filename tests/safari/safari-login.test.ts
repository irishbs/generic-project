import { spawn, type ChildProcess } from "node:child_process";
import { rmSync } from "node:fs";
import { Builder, By, until, type WebDriver, type WebElement } from "selenium-webdriver";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PASSWORD, uniqueEmail } from "../support/helpers.js";

// Real Safari, driven by Selenium WebDriver through Apple's safaridriver. Playwright can't drive
// the installed Safari app, so this suite covers the same core login flows with a second tool.
// Requires: `sudo safaridriver --enable` once, and "Allow Remote Automation" on in Safari's Develop menu.
//
// This suite starts its own copy of the app on port 3200, with its own database file.

const PORT = 3200;
const BASE = `http://localhost:${PORT}`;
const DB = `data/safari-${PORT}.sqlite`;
// Real Safari plus a bcrypt login can take several seconds on a busy machine, so waits are generous.
// A test that passes only after a long wait is still a real pass, not a retry.
const WAIT_MS = 30_000;

let server: ChildProcess | undefined;
let driver: WebDriver;

async function waitForServer(): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const res = await fetch(`${BASE}/api/openapi.json`);
      if (res.ok) return;
    } catch {
      // Not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`app did not start on ${BASE}`);
}

// Waits until the element exists and is visible, then returns it.
async function visible(selector: string): Promise<WebElement> {
  const element = await driver.wait(until.elementLocated(By.css(selector)), WAIT_MS);
  await driver.wait(until.elementIsVisible(element), WAIT_MS);
  return element;
}

async function fill(selector: string, text: string): Promise<void> {
  const element = await visible(selector);
  await element.clear();
  await element.sendKeys(text);
}

async function click(selector: string): Promise<void> {
  await (await visible(selector)).click();
}

async function textOf(selector: string): Promise<string> {
  return (await visible(selector)).getText();
}

beforeAll(async () => {
  for (const suffix of ["", "-wal", "-shm"]) rmSync(DB + suffix, { force: true });
  server = spawn("node", ["--import", "tsx", "src/index.ts"], {
    env: {
      ...process.env,
      NODE_ENV: "development",
      PORT: String(PORT),
      JWT_SECRET: "safari-test-secret-at-least-32-characters-long",
      DATABASE_PATH: DB,
    },
    stdio: "ignore",
  });
  await waitForServer();
  driver = await new Builder().forBrowser("safari").build();
}, 120_000);

afterAll(async () => {
  await driver?.quit();
  server?.kill();
  for (const suffix of ["", "-wal", "-shm"]) rmSync(DB + suffix, { force: true });
}, 60_000);

beforeEach(async () => {
  // Each test starts signed out, so one test's session can't leak into the next.
  await driver.get(`${BASE}/`);
  await driver.manage().deleteAllCookies();
});

describe("Login UI in Safari", () => {
  describe("Given a visitor on the register page", () => {
    it("When the password is too short, Then the server's message is shown and the page stays on /register", async () => {
      await driver.get(`${BASE}/register`);
      await fill("#register-email", uniqueEmail("safari-weak"));
      await fill("#register-password", "short");
      await click("#register-form button[type='submit']");

      expect(await textOf("#register-form [role='alert']")).toBe(
        "password must be at least 8 characters",
      );
      expect(await driver.getCurrentUrl()).toMatch(/\/register$/);
    });

    it("When the registration is valid, Then the page redirects to /login?registered=1 with the notice", async () => {
      await driver.get(`${BASE}/register`);
      await fill("#register-email", uniqueEmail("safari-new"));
      await fill("#register-password", PASSWORD);
      await click("#register-form button[type='submit']");

      await driver.wait(until.urlMatches(/\/login\?registered=1$/), WAIT_MS);
      expect(await textOf("[data-notice]")).toBe("Account created. Log in with your new password.");
    });
  });

  describe("Given a registered account", () => {
    async function registerAccount(email: string): Promise<void> {
      await driver.get(`${BASE}/register`);
      await fill("#register-email", email);
      await fill("#register-password", PASSWORD);
      await click("#register-form button[type='submit']");
      await driver.wait(until.urlMatches(/\/login\?registered=1$/), WAIT_MS);
    }

    it("When the password is wrong, Then the login page shows 'invalid email or password'", async () => {
      const email = uniqueEmail("safari-wrong");
      await registerAccount(email);

      await fill("#login-email", email);
      await fill("#login-password", "WrongPass1");
      await click("#login-form button[type='submit']");

      expect(await textOf("#login-form [role='alert']")).toBe("invalid email or password");
    });

    it("When the correct password is entered, Then the home page shows the signed-in email", async () => {
      const email = uniqueEmail("safari-in");
      await registerAccount(email);

      await fill("#login-email", email);
      await fill("#login-password", PASSWORD);
      await click("#login-form button[type='submit']");

      await driver.wait(until.urlIs(`${BASE}/`), WAIT_MS);
      expect(await textOf("#user-email")).toBe(email.toLowerCase());
    });

    it("When the user logs out, Then the home page returns to the signed-out view", async () => {
      const email = uniqueEmail("safari-out");
      await registerAccount(email);
      await fill("#login-email", email);
      await fill("#login-password", PASSWORD);
      await click("#login-form button[type='submit']");
      await driver.wait(until.urlIs(`${BASE}/`), WAIT_MS);

      await click("#logout-button");

      // Logout reloads the page, which makes any element from before the click stale. Wait for the
      // signed-out view on the reloaded page, and look the element up again on each try.
      await driver.wait(async () => {
        const elements = await driver.findElements(By.css("#signed-out"));
        return elements.length > 0 && (await elements[0]!.isDisplayed());
      }, WAIT_MS);
      expect(await driver.findElement(By.css("#signed-in")).isDisplayed()).toBe(false);
    });
  });

  describe("Given the browser reports its identity", () => {
    it("Then the session runs in Safari", async () => {
      const caps = await driver.getCapabilities();
      expect(String(caps.getBrowserName()).toLowerCase()).toContain("safari");
    });
  });
});
