import { expect, test } from "@playwright/test";
import { PASSWORD, uniqueEmail } from "../support/helpers.js";

// BDD-style API tests: each describe is a Given, each nested describe is a When,
// and each test is a Then. They call the running server over HTTP, like a client would.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

test.describe("POST /api/auth/register", () => {
  test.describe("Given a new email and a valid password", () => {
    test("Then it returns 201 with a UUID id and the lowercased email", async ({ request }) => {
      const email = uniqueEmail("New");
      const res = await request.post("/api/auth/register", {
        data: { email, password: PASSWORD },
      });

      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body.id).toMatch(UUID);
      expect(body.email).toBe(email.toLowerCase());
    });
  });

  test.describe("Given an account already exists", () => {
    test("When the same email is registered in a different case, Then it returns 409", async ({
      request,
    }) => {
      const email = uniqueEmail("Dup");
      await request.post("/api/auth/register", { data: { email, password: PASSWORD } });

      const res = await request.post("/api/auth/register", {
        data: { email: email.toUpperCase(), password: PASSWORD },
      });

      expect(res.status()).toBe(409);
      expect((await res.json()).error).toBe("email already registered");
    });
  });

  test.describe("When the password breaks a rule", () => {
    test("Then a password under 8 characters returns 400", async ({ request }) => {
      const res = await request.post("/api/auth/register", {
        data: { email: uniqueEmail("Short"), password: "abc1" },
      });

      expect(res.status()).toBe(400);
      expect((await res.json()).error).toBe("password must be at least 8 characters");
    });

    test("Then a password with no digit returns 400", async ({ request }) => {
      const res = await request.post("/api/auth/register", {
        data: { email: uniqueEmail("Letters"), password: "passwordonly" },
      });

      expect(res.status()).toBe(400);
      expect((await res.json()).error).toBe("password must contain a letter and a number");
    });
  });

  test.describe("When the request body is unusual", () => {
    test("Then malformed JSON returns 400", async ({ request }) => {
      const res = await request.post("/api/auth/register", {
        headers: { "Content-Type": "application/json" },
        data: "{not json",
      });

      expect(res.status()).toBe(400);
      expect((await res.json()).error).toBe("request body is not valid JSON");
    });

    test("Then a body over 10 KB returns 413", async ({ request }) => {
      const res = await request.post("/api/auth/register", {
        data: { email: `${"a".repeat(11 * 1024)}@example.com`, password: PASSWORD },
      });

      expect(res.status()).toBe(413);
    });

    test("Then a SQL injection attempt in the email returns 400", async ({ request }) => {
      const res = await request.post("/api/auth/register", {
        data: { email: "' OR '1'='1", password: PASSWORD },
      });

      expect(res.status()).toBe(400);
    });
  });
});

test.describe("POST /api/auth/login", () => {
  test.describe("Given a registered account", () => {
    test("When the correct password is sent, Then it returns 200 and an httpOnly SameSite=Strict session cookie", async ({
      request,
    }) => {
      const email = uniqueEmail("Login");
      await request.post("/api/auth/register", { data: { email, password: PASSWORD } });

      const res = await request.post("/api/auth/login", { data: { email, password: PASSWORD } });

      expect(res.status()).toBe(200);
      expect((await res.json()).email).toBe(email.toLowerCase());

      const state = await request.storageState();
      const session = state.cookies.find((c) => c.name === "session");
      expect(session, "session cookie is set").toBeDefined();
      expect(session?.httpOnly).toBe(true);
      expect(session?.sameSite).toBe("Strict");
    });

    test("When the password is wrong, Then it returns 401", async ({ request }) => {
      const email = uniqueEmail("Wrong");
      await request.post("/api/auth/register", { data: { email, password: PASSWORD } });

      const res = await request.post("/api/auth/login", {
        data: { email, password: "WrongPass1" },
      });

      expect(res.status()).toBe(401);
    });

    test("When the email is unknown, Then it returns the same body as a wrong password", async ({
      request,
    }) => {
      const email = uniqueEmail("Known");
      await request.post("/api/auth/register", { data: { email, password: PASSWORD } });

      const wrongPassword = await request.post("/api/auth/login", {
        data: { email, password: "WrongPass1" },
      });
      const unknown = await request.post("/api/auth/login", {
        data: { email: uniqueEmail("Nobody"), password: "WrongPass1" },
      });

      expect(unknown.status()).toBe(401);
      expect(await unknown.json()).toEqual(await wrongPassword.json());
    });
  });
});

test.describe("GET /api/auth/me and POST /api/auth/logout", () => {
  test.describe("Given a logged-in user", () => {
    test("When /me is called, Then it returns the user", async ({ request }) => {
      const email = uniqueEmail("Me");
      await request.post("/api/auth/register", { data: { email, password: PASSWORD } });
      await request.post("/api/auth/login", { data: { email, password: PASSWORD } });

      const res = await request.get("/api/auth/me");

      expect(res.status()).toBe(200);
      expect((await res.json()).email).toBe(email.toLowerCase());
    });

    test("When logout is called, Then it returns 204, and the same session is refused afterwards", async ({
      request,
    }) => {
      const email = uniqueEmail("Out");
      await request.post("/api/auth/register", { data: { email, password: PASSWORD } });
      await request.post("/api/auth/login", { data: { email, password: PASSWORD } });

      // Keep a copy of the cookie, because the server clears it on logout.
      const state = await request.storageState();
      const cookie = state.cookies.find((c) => c.name === "session")?.value ?? "";

      const logout = await request.post("/api/auth/logout");
      expect(logout.status()).toBe(204);

      const replay = await request.get("/api/auth/me", {
        headers: { Cookie: `session=${cookie}` },
      });
      expect(replay.status()).toBe(401);
      expect((await replay.json()).error).toBe("session has been logged out");
    });
  });

  test.describe("Given no session", () => {
    test("When /me is called, Then it returns 401", async ({ request }) => {
      const res = await request.get("/api/auth/me");

      expect(res.status()).toBe(401);
    });

    test("When logout is called, Then it returns 401", async ({ request }) => {
      const res = await request.post("/api/auth/logout");

      expect(res.status()).toBe(401);
    });

    test("When a forged session cookie is sent, Then it returns 401", async ({ request }) => {
      const res = await request.get("/api/auth/me", {
        headers: { Cookie: "session=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbiJ9.forged" },
      });

      expect(res.status()).toBe(401);
    });
  });
});
