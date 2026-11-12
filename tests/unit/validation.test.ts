import { describe, expect, it } from "vitest";
import { validateEmail, validatePassword } from "../../src/auth/validation.js";

describe("validateEmail", () => {
  it.each(["alice@example.com", "first.last+tag@sub.example.org"])("accepts %s", (email) => {
    expect(validateEmail(email)).toBeNull();
  });

  it.each([
    ["missing @", "alice.example.com"],
    ["missing domain dot", "alice@example"],
    ["contains a space", "alice smith@example.com"],
    ["empty string", ""],
  ])("rejects %s", (_label, email) => {
    expect(validateEmail(email)).toBe("email is not valid");
  });

  it("rejects a non-string value", () => {
    expect(validateEmail(42)).toBe("email must be a string");
    expect(validateEmail(undefined)).toBe("email must be a string");
  });

  it("rejects an email longer than 254 characters", () => {
    const longEmail = "a".repeat(250) + "@b.co";
    expect(validateEmail(longEmail)).toBe("email must be at most 254 characters");
  });
});

describe("validatePassword", () => {
  it("accepts a password with a letter and a number, at least 8 characters", () => {
    expect(validatePassword("Passw0rd!")).toBeNull();
  });

  it("rejects a password shorter than 8 characters", () => {
    expect(validatePassword("abc123")).toBe("password must be at least 8 characters");
  });

  it("rejects a password with no digit", () => {
    expect(validatePassword("passwordonly")).toBe("password must contain a letter and a number");
  });

  it("rejects a password with no letter", () => {
    expect(validatePassword("12345678")).toBe("password must contain a letter and a number");
  });

  it("accepts exactly 72 bytes", () => {
    expect(validatePassword("a1" + "x".repeat(70))).toBeNull();
  });

  it("rejects more than 72 bytes, even when the character count is under 72", () => {
    // Each "é" is 2 bytes in UTF-8, so 40 of them plus "a1" is 82 bytes but only 42 characters.
    const password = "é".repeat(40) + "a1";
    expect(password.length).toBeLessThan(72);
    expect(validatePassword(password)).toBe("password must be at most 72 bytes");
  });

  it("rejects a non-string value", () => {
    expect(validatePassword(12345678)).toBe("password must be a string");
  });
});
