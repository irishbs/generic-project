import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { openDatabase, type Db } from "../../src/db.js";

// Behavior-style tests: each describe block sets up a Given, each nested block is a When,
// and each it() is a Then. Every test gets a fresh in-memory database.

const JWT_SECRET = "t".repeat(32);
const EMAIL = "alice@example.com";
const PASSWORD = "Passw0rd!";

describe("Auth API", () => {
  let db: Db;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    db = openDatabase(":memory:");
    app = createApp({ db, jwtSecret: JWT_SECRET, cookieSecure: false, enableDocs: false });
  });

  afterEach(() => {
    db.close();
  });

  // Helper: create an account directly through the API.
  async function registerAccount(email = EMAIL, password = PASSWORD) {
    return request(app).post("/api/auth/register").send({ email, password });
  }

  describe("POST /api/auth/register", () => {
    describe("Given no account exists for alice@example.com", () => {
      it("Then a valid registration returns 201 with the id and the lowercased email", async () => {
        const res = await request(app)
          .post("/api/auth/register")
          .send({ email: "Alice@Example.com", password: PASSWORD });

        expect(res.status).toBe(201);
        expect(res.body.email).toBe(EMAIL);
        expect(typeof res.body.id).toBe("string");
      });

      it("Then the password is stored as a hash, never as plain text", async () => {
        await registerAccount();
        const row = db.prepare("SELECT password_hash FROM users WHERE email = ?").get(EMAIL) as {
          password_hash: string;
        };

        expect(row.password_hash).not.toContain(PASSWORD);
        expect(row.password_hash).toMatch(/^\$2[aby]\$/);
      });
    });

    describe("Given an account already exists for alice@example.com", () => {
      beforeEach(async () => {
        await registerAccount();
      });

      it("Then registering the same email in a different case returns 409", async () => {
        const res = await request(app)
          .post("/api/auth/register")
          .send({ email: "ALICE@example.com", password: PASSWORD });

        expect(res.status).toBe(409);
        expect(res.body.error).toBe("email already registered");
      });
    });

    describe("When the input is invalid", () => {
      it("Then a password shorter than 8 characters returns 400", async () => {
        const res = await request(app)
          .post("/api/auth/register")
          .send({ email: "bob@example.com", password: "short" });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("password must be at least 8 characters");
      });

      it("Then a malformed email returns 400", async () => {
        const res = await request(app)
          .post("/api/auth/register")
          .send({ email: "not-an-email", password: PASSWORD });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("email is not valid");
      });

      it("Then a body that is not JSON returns 400", async () => {
        const res = await request(app)
          .post("/api/auth/register")
          .set("Content-Type", "application/json")
          .send("{bad json");

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("request body is not valid JSON");
      });

      it("Then a body sent as plain text (not JSON) is rejected as missing fields", async () => {
        const res = await request(app)
          .post("/api/auth/register")
          .set("Content-Type", "text/plain")
          .send("email=alice@example.com&password=Passw0rd!");

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("email must be a string");
      });
    });
  });

  describe("POST /api/auth/login", () => {
    describe("Given a registered account", () => {
      beforeEach(async () => {
        await registerAccount();
      });

      it("When the correct password is sent, Then it returns 200 and sets an httpOnly session cookie", async () => {
        const res = await request(app)
          .post("/api/auth/login")
          .send({ email: EMAIL, password: PASSWORD });

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ email: EMAIL });

        const cookie = res.headers["set-cookie"]?.[0] ?? "";
        expect(cookie).toMatch(/^session=/);
        expect(cookie).toMatch(/HttpOnly/);
        expect(cookie).toMatch(/SameSite=Strict/);
      });

      it("When the password is wrong, Then it returns 401", async () => {
        const res = await request(app)
          .post("/api/auth/login")
          .send({ email: EMAIL, password: "WrongPass1" });

        expect(res.status).toBe(401);
        expect(res.body.error).toBe("invalid email or password");
      });

      it("When the email is unknown, Then it returns the same 401 body as a wrong password", async () => {
        const wrongPassword = await request(app)
          .post("/api/auth/login")
          .send({ email: EMAIL, password: "WrongPass1" });
        const unknownEmail = await request(app)
          .post("/api/auth/login")
          .send({ email: "nobody@example.com", password: "WrongPass1" });

        expect(unknownEmail.status).toBe(401);
        expect(unknownEmail.body).toEqual(wrongPassword.body);
      });

      it("When email or password is missing, Then it returns 400", async () => {
        const res = await request(app).post("/api/auth/login").send({ email: EMAIL });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("email and password are required");
      });
    });
  });

  describe("GET /api/auth/me", () => {
    describe("Given a logged-in user", () => {
      it("When the session cookie is sent, Then it returns the user", async () => {
        await registerAccount();
        const agent = request.agent(app);
        await agent.post("/api/auth/login").send({ email: EMAIL, password: PASSWORD });

        const res = await agent.get("/api/auth/me");

        expect(res.status).toBe(200);
        expect(res.body.email).toBe(EMAIL);
      });

      it("When the account is deleted after login, Then it returns 401", async () => {
        await registerAccount();
        const agent = request.agent(app);
        await agent.post("/api/auth/login").send({ email: EMAIL, password: PASSWORD });
        db.prepare("DELETE FROM users WHERE email = ?").run(EMAIL);

        const res = await agent.get("/api/auth/me");

        expect(res.status).toBe(401);
        expect(res.body.error).toBe("account no longer exists");
      });
    });

    describe("Given no session", () => {
      it("When no cookie is sent, Then it returns 401", async () => {
        const res = await request(app).get("/api/auth/me");

        expect(res.status).toBe(401);
        expect(res.body.error).toBe("not logged in");
      });

      it("When the cookie has been tampered with, Then it returns 401", async () => {
        await registerAccount();
        const login = await request(app)
          .post("/api/auth/login")
          .send({ email: EMAIL, password: PASSWORD });
        const token = /session=([^;]+)/.exec(login.headers["set-cookie"]?.[0] ?? "")?.[1] ?? "";
        // Change the first character of the signature. Its six bits are all data, so the signature
        // always changes. Changing the last character can be a no-op: its final bits are padding,
        // so the token would still verify on some runs and not on others.
        const [header, payload, signature = ""] = token.split(".");
        const flipped = signature[0] === "A" ? "B" : "A";
        const tampered = [header, payload, `${flipped}${signature.slice(1)}`].join(".");

        const res = await request(app).get("/api/auth/me").set("Cookie", `session=${tampered}`);

        expect(res.status).toBe(401);
        expect(res.body.error).toBe("invalid or expired session");
      });
    });
  });

  describe("POST /api/auth/logout", () => {
    describe("Given a logged-in user", () => {
      it("When logout is called, Then it returns 204 and clears the cookie", async () => {
        await registerAccount();
        const agent = request.agent(app);
        await agent.post("/api/auth/login").send({ email: EMAIL, password: PASSWORD });

        const res = await agent.post("/api/auth/logout");

        expect(res.status).toBe(204);
        expect(res.headers["set-cookie"]?.[0]).toMatch(/^session=;/);
      });

      it("Then the same token is refused afterwards, even though it has not expired", async () => {
        await registerAccount();
        const login = await request(app)
          .post("/api/auth/login")
          .send({ email: EMAIL, password: PASSWORD });
        const cookie = login.headers["set-cookie"]?.[0] ?? "";

        await request(app).post("/api/auth/logout").set("Cookie", cookie);
        const replay = await request(app).get("/api/auth/me").set("Cookie", cookie);

        expect(replay.status).toBe(401);
        expect(replay.body.error).toBe("session has been logged out");
      });

      it("Then logging out a second time with the same token returns 401", async () => {
        await registerAccount();
        const login = await request(app)
          .post("/api/auth/login")
          .send({ email: EMAIL, password: PASSWORD });
        const cookie = login.headers["set-cookie"]?.[0] ?? "";

        const first = await request(app).post("/api/auth/logout").set("Cookie", cookie);
        const second = await request(app).post("/api/auth/logout").set("Cookie", cookie);

        expect(first.status).toBe(204);
        expect(second.status).toBe(401);
        expect(second.body.error).toBe("session has been logged out");
      });
    });

    describe("Given no session", () => {
      it("When logout is called, Then it returns 401", async () => {
        const res = await request(app).post("/api/auth/logout");

        expect(res.status).toBe(401);
        expect(res.body.error).toBe("not logged in");
      });
    });
  });
});
