import { describe, expect, it } from "vitest";
import { validateEmail, validatePassword } from "../../src/auth/validation.js";

const EMAIL_ERROR = "email is not valid";
const PASSWORD_LENGTH_ERROR = "password must be at least 8 characters";
const PASSWORD_COMPOSITION_ERROR = "password must contain a letter and a number";
const PASSWORD_BYTES_ERROR = "password must be at most 72 bytes";

describe("validateEmail", () => {
  describe("accepts valid addresses", () => {
    it.each([
      ["a simple address", "alice@example.com"],
      ["plus addressing", "first.last+tag@sub.example.org"],
      ["an apostrophe in the local part", "o'neil@example.com"],
      ["underscore and hyphen", "user_name-1@my-domain.io"],
      ["the shortest valid form", "a@b.co"],
      ["surrounding whitespace (trimmed before checking)", "  alice@example.com  "],
    ])("%s", (_label, email) => {
      expect(validateEmail(email)).toBeNull();
    });
  });

  describe("rejects malformed addresses", () => {
    it.each([
      ["two @ signs", "alice@@example.com"],
      ["empty local part", "@example.com"],
      ["empty domain", "alice@"],
      ["no dot in domain", "alice@example"],
      ["trailing dot in domain", "alice@example."],
      ["leading dot in domain label", "alice@.example.com"],
      ["hyphen starts a domain label", "alice@-example.com"],
      ["hyphen ends a domain label", "alice@example-.com"],
      ["single-letter top-level domain", "alice@example.c"],
      ["underscore in domain", "alice@exa_mple.com"],
      ["space inside the domain", "alice@exa mple.com"],
      ["space inside the local part", "alice smith@example.com"],
      ["consecutive dots in local part", "a..b@example.com"],
      ["leading dot in local part", ".alice@example.com"],
      ["trailing dot in local part", "alice.@example.com"],
      ["non-ASCII characters", "josé@example.com"],
      ["angle brackets (HTML-like input)", "<script>@example.com"],
      ["quotes that could break out of a string", 'alice"@example.com'],
      ["empty string", ""],
    ])("rejects %s", (_label, email) => {
      expect(validateEmail(email)).toBe(EMAIL_ERROR);
    });
  });

  describe("length limits", () => {
    it("accepts a local part of exactly 64 characters", () => {
      expect(validateEmail(`${"a".repeat(64)}@example.com`)).toBeNull();
    });

    it("rejects a local part of 65 characters", () => {
      expect(validateEmail(`${"a".repeat(65)}@example.com`)).toBe(EMAIL_ERROR);
    });

    it("rejects an address longer than 254 characters", () => {
      const longEmail = `${"a".repeat(250)}@b.co`;
      expect(validateEmail(longEmail)).toBe("email must be at most 254 characters");
    });
  });

  it("rejects a non-string value", () => {
    expect(validateEmail(42)).toBe("email must be a string");
    expect(validateEmail(undefined)).toBe("email must be a string");
    expect(validateEmail(null)).toBe("email must be a string");
  });
});

describe("validatePassword", () => {
  describe("minimum length", () => {
    it("accepts exactly 8 characters", () => {
      expect(validatePassword("abcdefg1")).toBeNull();
    });

    it("rejects 7 characters", () => {
      expect(validatePassword("abcdef1")).toBe(PASSWORD_LENGTH_ERROR);
    });

    it("rejects an empty string", () => {
      expect(validatePassword("")).toBe(PASSWORD_LENGTH_ERROR);
    });
  });

  describe("composition: needs an English letter (A-Z) and a digit", () => {
    it("accepts a letter and a digit mixed", () => {
      expect(validatePassword("Passw0rd!")).toBeNull();
    });

    it("accepts spaces inside the password", () => {
      expect(validatePassword("pass word 1")).toBeNull();
    });

    it("rejects letters only", () => {
      expect(validatePassword("passwordonly")).toBe(PASSWORD_COMPOSITION_ERROR);
    });

    it("rejects digits only", () => {
      expect(validatePassword("12345678")).toBe(PASSWORD_COMPOSITION_ERROR);
    });

    it("rejects symbols and spaces with no letter or digit", () => {
      expect(validatePassword("!@#$%^&*")).toBe(PASSWORD_COMPOSITION_ERROR);
    });

    it("rejects non-English letters, because the rule checks A-Z", () => {
      expect(validatePassword("éééééééé1")).toBe(PASSWORD_COMPOSITION_ERROR);
    });
  });

  describe("maximum length in bytes (bcrypt uses the first 72 bytes)", () => {
    it("accepts exactly 72 bytes", () => {
      expect(validatePassword(`a1${"x".repeat(70)}`)).toBeNull();
    });

    it("rejects 73 bytes", () => {
      expect(validatePassword(`a1${"x".repeat(71)}`)).toBe(PASSWORD_BYTES_ERROR);
    });

    it("counts bytes, not characters: 40 two-byte characters plus 'a1' is over 72 bytes", () => {
      // Each "é" is 2 bytes in UTF-8. The string has 42 characters but 82 bytes.
      // The "a1" ending supplies the ASCII letter and digit the composition rule needs.
      const password = `${"é".repeat(40)}a1`;
      expect(password.length).toBeLessThan(72);
      expect(validatePassword(password)).toBe(PASSWORD_BYTES_ERROR);
    });
  });

  it("rejects a non-string value", () => {
    expect(validatePassword(12345678)).toBe("password must be a string");
    expect(validatePassword(null)).toBe("password must be a string");
  });
});
