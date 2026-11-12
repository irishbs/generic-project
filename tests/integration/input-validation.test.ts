import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { openDatabase, type Db } from "../../src/db.js";

// Behavior-style tests for hostile and unusual input reaching the API.
// Given a database with one known account, when a payload is sent, then the app
// never crashes (no 500), never returns a session it shouldn't, and never changes the data.

const JWT_SECRET = "t".repeat(32);
const KNOWN_EMAIL = "alice@example.com";
const KNOWN_PASSWORD = "Passw0rd!";

// Classic SQL injection strings, plus variants that try to break out of quotes,
// comment out the rest of a query, stack a second statement, or always match.
const SQL_INJECTION_PAYLOADS = [
  "' OR '1'='1",
  "' OR 1=1 --",
  "alice@example.com' --",
  '" OR ""="',
  "'; DROP TABLE users; --",
  "1; DELETE FROM users",
  "' UNION SELECT id, email, password_hash FROM users --",
  "admin'/*",
];

describe("Input validation and injection resistance", () => {
  let db: Db;
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    db = openDatabase(":memory:");
    app = createApp({ db, jwtSecret: JWT_SECRET, cookieSecure: false, enableDocs: false });
    await request(app)
      .post("/api/auth/register")
      .send({ email: KNOWN_EMAIL, password: KNOWN_PASSWORD });
  });

  afterEach(() => {
    db.close();
  });

  function userCount(): number {
    return (db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n;
  }

  describe("SQL injection in the login form", () => {
    describe("Given one account exists", () => {
      it.each(SQL_INJECTION_PAYLOADS)(
        "When the email is %s, Then login is refused without a server error",
        async (payload) => {
          const res = await request(app)
            .post("/api/auth/login")
            .send({ email: payload, password: KNOWN_PASSWORD });

          expect(res.status).not.toBe(500);
          expect([400, 401]).toContain(res.status);
          expect(res.headers["set-cookie"]).toBeUndefined();
        },
      );

      it.each(SQL_INJECTION_PAYLOADS)(
        "When the password is %s, Then login is refused without a server error",
        async (payload) => {
          const res = await request(app)
            .post("/api/auth/login")
            .send({ email: KNOWN_EMAIL, password: payload });

          expect(res.status).not.toBe(500);
          expect([400, 401]).toContain(res.status);
          expect(res.headers["set-cookie"]).toBeUndefined();
        },
      );

      it("When the email is an always-true payload that is also a valid-looking address, Then it still returns 401", async () => {
        // Passes email validation, so the query itself must treat it as a literal string.
        const res = await request(app)
          .post("/api/auth/login")
          .send({ email: "x' OR '1'='1@example.com", password: "anything1" });

        expect(res.status).toBe(401);
        expect(res.body.error).toBe("invalid email or password");
      });
    });
  });

  describe("SQL injection in the registration form", () => {
    it.each(SQL_INJECTION_PAYLOADS)(
      "When the email is %s, Then no account is created and no server error occurs",
      async (payload) => {
        const before = userCount();
        const res = await request(app)
          .post("/api/auth/register")
          .send({ email: payload, password: "Passw0rd!" });

        expect(res.status).not.toBe(500);
        expect(res.status).toBe(400);
        expect(userCount()).toBe(before);
      },
    );

    it("When a payload is sent as a well-formed email, Then it is stored as literal text, not executed", async () => {
      // Valid by the email rules, so it is stored. The point is that nothing else changes.
      const email = "o'brien@example.com";
      const res = await request(app)
        .post("/api/auth/register")
        .send({ email, password: "Passw0rd!" });

      expect(res.status).toBe(201);
      expect(res.body.email).toBe(email);
      expect(userCount()).toBe(2);
    });
  });

  describe("The database is intact after every attack", () => {
    it("Then the original account still exists and still logs in", async () => {
      for (const payload of SQL_INJECTION_PAYLOADS) {
        await request(app).post("/api/auth/login").send({ email: payload, password: payload });
        await request(app).post("/api/auth/register").send({ email: payload, password: payload });
      }

      expect(userCount()).toBe(1);
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: KNOWN_EMAIL, password: KNOWN_PASSWORD });
      expect(res.status).toBe(200);
    });
  });

  describe("Other hostile input", () => {
    it("Then a script tag in the email is rejected, so it never reaches the page", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ email: "<script>alert(1)</script>@example.com", password: "Passw0rd!" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("email is not valid");
    });

    it("Then a body over 10 KB is rejected with 413, not processed", async () => {
      const huge = "a".repeat(11 * 1024);
      const res = await request(app)
        .post("/api/auth/register")
        .send({ email: `${huge}@example.com`, password: "Passw0rd!" });

      expect(res.status).toBe(413);
    });

    it("Then an email with surrounding spaces logs in the same as the trimmed address", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: `  ${KNOWN_EMAIL}  `, password: KNOWN_PASSWORD });

      expect(res.status).toBe(200);
    });

    it("Then an uppercase email logs in the same as the lowercase address", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "ALICE@EXAMPLE.COM", password: KNOWN_PASSWORD });

      expect(res.status).toBe(200);
    });
  });
});
