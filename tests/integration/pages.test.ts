import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { openDatabase, type Db } from "../../src/db.js";

// Behavior-style tests for the login UI pages (S2).
// Browser behavior (typing, clicking, redirects) is verified by the Playwright tests in S6.
// These tests check that each page is served and has the form elements the scripts rely on.

const JWT_SECRET = "t".repeat(32);

describe("Login UI pages", () => {
  let db: Db;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    db = openDatabase(":memory:");
    app = createApp({ db, jwtSecret: JWT_SECRET, cookieSecure: false, enableDocs: false });
  });

  afterEach(() => {
    db.close();
  });

  describe("Given a visitor opens the home page", () => {
    it("When / is requested, Then it returns the HTML home page", async () => {
      const res = await request(app).get("/");

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/text\/html/);
      expect(res.text).toMatch(/<title>[^<]+<\/title>/);
    });

    it("Then the home page has links to log in and register", async () => {
      const res = await request(app).get("/");

      expect(res.text).toContain('href="/login"');
      expect(res.text).toContain('href="/register"');
    });

    it("Then the home page loads the home script that checks the session", async () => {
      const res = await request(app).get("/");

      expect(res.text).toContain('src="/js/home.js"');
    });
  });

  describe("Given a visitor opens the login page", () => {
    it("When /login is requested, Then it returns the login form", async () => {
      const res = await request(app).get("/login");

      expect(res.status).toBe(200);
      expect(res.text).toMatch(/<form[^>]*id="login-form"/);
      expect(res.text).toMatch(
        /<input[^>]*name="email"[^>]*type="email"|<input[^>]*type="email"[^>]*name="email"/,
      );
      expect(res.text).toMatch(
        /<input[^>]*name="password"[^>]*type="password"|<input[^>]*type="password"[^>]*name="password"/,
      );
    });

    it("Then the form posts to the login endpoint", async () => {
      const res = await request(app).get("/login");

      expect(res.text).toContain('data-endpoint="/api/auth/login"');
    });

    it("Then the page has an alert region for error messages", async () => {
      const res = await request(app).get("/login");

      expect(res.text).toMatch(/role="alert"/);
    });

    it("Then the page has a notice region for 'account created' messages", async () => {
      const res = await request(app).get("/login");

      expect(res.text).toMatch(/data-notice/);
    });
  });

  describe("Given a visitor opens the register page", () => {
    it("When /register is requested, Then it returns the register form", async () => {
      const res = await request(app).get("/register");

      expect(res.status).toBe(200);
      expect(res.text).toMatch(/<form[^>]*id="register-form"/);
      expect(res.text).toContain('data-endpoint="/api/auth/register"');
    });

    it("Then the password field uses new-password autofill, and the rules are shown", async () => {
      const res = await request(app).get("/register");

      expect(res.text).toContain('autocomplete="new-password"');
      expect(res.text).toContain("at least 8 characters");
      expect(res.text).toContain("a letter and a number");
    });

    it("Then the form redirects to the login page after success", async () => {
      const res = await request(app).get("/register");

      expect(res.text).toContain('data-success="/login?registered=1"');
    });
  });

  describe("Given the scripts and styles the pages use", () => {
    it("When the shared form script is requested, Then it is served as JavaScript", async () => {
      const res = await request(app).get("/js/auth-form.js");

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/javascript/);
    });

    it("When the home script is requested, Then it is served as JavaScript", async () => {
      const res = await request(app).get("/js/home.js");

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/javascript/);
    });

    it("When the stylesheet is requested, Then it is served as CSS", async () => {
      const res = await request(app).get("/css/style.css");

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/text\/css/);
    });
  });

  describe("Given a page that does not exist", () => {
    it("When an unknown path is requested, Then it returns 404", async () => {
      const res = await request(app).get("/no-such-page");

      expect(res.status).toBe(404);
    });
  });

  describe("Given the API still works next to the pages", () => {
    it("When /api/auth/me is requested without a session, Then it still returns JSON 401", async () => {
      const res = await request(app).get("/api/auth/me");

      expect(res.status).toBe(401);
      expect(res.headers["content-type"]).toMatch(/application\/json/);
    });
  });
});
