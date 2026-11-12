import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { openDatabase, type Db } from "../../src/db.js";

// Behavior-style tests for the interactive API docs (Swagger UI).

const JWT_SECRET = "t".repeat(32);

describe("API docs", () => {
  let db: Db;

  beforeEach(() => {
    db = openDatabase(":memory:");
  });

  afterEach(() => {
    db.close();
  });

  describe("Given docs are enabled (development)", () => {
    let app: ReturnType<typeof createApp>;

    beforeEach(() => {
      app = createApp({ db, jwtSecret: JWT_SECRET, cookieSecure: false, enableDocs: true });
    });

    it("When the Swagger UI page is requested, Then it returns the HTML page", async () => {
      const res = await request(app).get("/api/docs/");

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/text\/html/);
      expect(res.text).toMatch(/swagger/i);
    });

    it("When the raw spec is requested, Then it returns the OpenAPI document as JSON", async () => {
      const res = await request(app).get("/api/openapi.json");

      expect(res.status).toBe(200);
      expect(res.body.openapi).toMatch(/^3\./);
      expect(Object.keys(res.body.paths)).toContain("/api/auth/login");
    });
  });

  describe("Given docs are disabled (production)", () => {
    let app: ReturnType<typeof createApp>;

    beforeEach(() => {
      app = createApp({ db, jwtSecret: JWT_SECRET, cookieSecure: true, enableDocs: false });
    });

    it("When the Swagger UI page is requested, Then it returns 404", async () => {
      const res = await request(app).get("/api/docs/");

      expect(res.status).toBe(404);
    });

    it("When the raw spec is requested, Then it returns 404", async () => {
      const res = await request(app).get("/api/openapi.json");

      expect(res.status).toBe(404);
    });
  });
});
