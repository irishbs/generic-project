import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config.js";

const VALID_SECRET = "x".repeat(32);

describe("loadConfig", () => {
  it("throws when JWT_SECRET is missing", () => {
    expect(() => loadConfig({})).toThrow("JWT_SECRET must be set to at least 32 characters");
  });

  it("throws when JWT_SECRET is shorter than 32 characters", () => {
    expect(() => loadConfig({ JWT_SECRET: "short" })).toThrow("at least 32 characters");
  });

  it("throws when JWT_SECRET is the .env.example placeholder", () => {
    // Long enough to pass the length check, so only the placeholder check can catch it.
    const placeholder = "change-me-to-a-long-random-string";
    expect(placeholder.length).toBeGreaterThanOrEqual(32);
    expect(() => loadConfig({ JWT_SECRET: placeholder })).toThrow("still the placeholder");
  });

  it("uses defaults for port and database path", () => {
    const config = loadConfig({ JWT_SECRET: VALID_SECRET });
    expect(config.port).toBe(3000);
    expect(config.databasePath).toBe("./data/app.sqlite");
  });

  it("reads PORT and DATABASE_PATH when set", () => {
    const config = loadConfig({
      JWT_SECRET: VALID_SECRET,
      PORT: "8080",
      DATABASE_PATH: "/tmp/test.sqlite",
    });
    expect(config.port).toBe(8080);
    expect(config.databasePath).toBe("/tmp/test.sqlite");
  });

  it("turns on secure cookies only in production", () => {
    expect(loadConfig({ JWT_SECRET: VALID_SECRET }).cookieSecure).toBe(false);
    expect(loadConfig({ JWT_SECRET: VALID_SECRET, NODE_ENV: "development" }).cookieSecure).toBe(
      false,
    );
    expect(loadConfig({ JWT_SECRET: VALID_SECRET, NODE_ENV: "production" }).cookieSecure).toBe(
      true,
    );
  });

  it("enables API docs outside production", () => {
    expect(loadConfig({ JWT_SECRET: VALID_SECRET }).enableDocs).toBe(true);
    expect(loadConfig({ JWT_SECRET: VALID_SECRET, NODE_ENV: "development" }).enableDocs).toBe(true);
  });

  it("disables API docs in production", () => {
    expect(loadConfig({ JWT_SECRET: VALID_SECRET, NODE_ENV: "production" }).enableDocs).toBe(false);
  });
});
