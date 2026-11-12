import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { openDatabase, type Db } from "../../src/db.js";

// Behavior-style tests against a real SQLite database file (not :memory:).
// They check what the database itself guarantees: schema, constraints, persistence across
// restarts, and the logout list. Each test gets its own temporary directory.

const JWT_SECRET = "t".repeat(32);
const EMAIL = "carol@example.com";
const PASSWORD = "Passw0rd!";

describe("SQLite database (file-backed)", () => {
  let dir: string;
  let dbPath: string;
  let db: Db;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "generic-project-s4-"));
    dbPath = join(dir, "test.sqlite");
    db = openDatabase(dbPath);
  });

  afterEach(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  function appFor(database: Db) {
    return createApp({
      db: database,
      jwtSecret: JWT_SECRET,
      cookieSecure: false,
      enableDocs: false,
    });
  }

  describe("Given a newly created database file", () => {
    it("Then it is in WAL journal mode, so readers don't block the writer", () => {
      const mode = db.pragma("journal_mode", { simple: true });
      expect(mode).toBe("wal");
    });

    it("Then foreign key enforcement is switched on for every connection", () => {
      expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
    });

    it("Then it has the users and revoked_tokens tables", () => {
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
        .all()
        .map((row) => (row as { name: string }).name);

      expect(tables).toEqual(expect.arrayContaining(["users", "revoked_tokens"]));
    });

    it("Then opening the same file again keeps existing data and does not fail", async () => {
      await request(appFor(db))
        .post("/api/auth/register")
        .send({ email: EMAIL, password: PASSWORD });
      db.close();

      const reopened = openDatabase(dbPath);
      try {
        const count = (reopened.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number })
          .n;
        expect(count).toBe(1);
      } finally {
        reopened.close();
        db = openDatabase(dbPath); // so afterEach has an open handle to close
      }
    });
  });

  describe("Given the database enforces its own rules", () => {
    it("When two rows try to use the same email, Then SQLite rejects the second one", () => {
      const insert = db.prepare("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)");
      insert.run("id-1", EMAIL, "hash");

      expect(() => insert.run("id-2", EMAIL, "hash")).toThrow(/UNIQUE constraint failed/);
    });

    it("When a row has no password hash, Then SQLite rejects it", () => {
      expect(() =>
        db
          .prepare("INSERT INTO users (id, email, password_hash) VALUES (?, ?, NULL)")
          .run("id-3", "nohash@example.com"),
      ).toThrow(/NOT NULL constraint failed/);
    });

    it("When a revoked token id is stored twice, Then the second insert is refused", () => {
      const insert = db.prepare("INSERT INTO revoked_tokens (jti, expires_at) VALUES (?, ?)");
      insert.run("jti-1", 1_900_000_000);

      expect(() => insert.run("jti-1", 1_900_000_000)).toThrow(/UNIQUE constraint failed/);
    });

    it("When a user gets a created_at timestamp automatically, Then it is set without the app providing it", () => {
      db.prepare("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)").run(
        "id-4",
        "timestamp@example.com",
        "hash",
      );
      const row = db.prepare("SELECT created_at FROM users WHERE id = ?").get("id-4") as {
        created_at: string;
      };

      expect(row.created_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });
  });

  describe("Given an account and a session, then the app restarts", () => {
    it("When the app restarts on the same file, Then the account can still log in", async () => {
      await request(appFor(db))
        .post("/api/auth/register")
        .send({ email: EMAIL, password: PASSWORD });
      db.close();

      db = openDatabase(dbPath);
      const res = await request(appFor(db))
        .post("/api/auth/login")
        .send({ email: EMAIL, password: PASSWORD });

      expect(res.status).toBe(200);
    });

    it("When a session is logged out and the app restarts, Then the logged-out token is still refused", async () => {
      const app = appFor(db);
      await request(app).post("/api/auth/register").send({ email: EMAIL, password: PASSWORD });
      const login = await request(app)
        .post("/api/auth/login")
        .send({ email: EMAIL, password: PASSWORD });
      const cookie = login.headers["set-cookie"]?.[0] ?? "";
      await request(app).post("/api/auth/logout").set("Cookie", cookie);
      db.close();

      // A restart must not forget the logout, or a stolen cookie would work again.
      db = openDatabase(dbPath);
      const res = await request(appFor(db)).get("/api/auth/me").set("Cookie", cookie);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("session has been logged out");
    });
  });

  describe("Given two registrations for the same email at the same time", () => {
    it("When both arrive together, Then exactly one succeeds and the other gets 409", async () => {
      const app = appFor(db);
      const [first, second] = await Promise.all([
        request(app).post("/api/auth/register").send({ email: EMAIL, password: PASSWORD }),
        request(app).post("/api/auth/register").send({ email: EMAIL, password: PASSWORD }),
      ]);

      expect([first.status, second.status].sort()).toEqual([201, 409]);
      const count = (db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n;
      expect(count).toBe(1);
    });
  });
});
