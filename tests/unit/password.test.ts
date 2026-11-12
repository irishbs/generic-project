import { describe, expect, it } from "vitest";
import { DUMMY_HASH, hashPassword, verifyPassword } from "../../src/auth/password.js";

describe("hashPassword", () => {
  it("never returns the plain password", async () => {
    const hash = await hashPassword("Passw0rd!");
    expect(hash).not.toContain("Passw0rd!");
  });

  it("returns a bcrypt-format hash", async () => {
    const hash = await hashPassword("Passw0rd!");
    expect(hash).toMatch(/^\$2[aby]\$12\$/); // bcrypt prefix and the cost factor of 12
  });

  it("salts each hash, so the same password gives different hashes", async () => {
    const first = await hashPassword("Passw0rd!");
    const second = await hashPassword("Passw0rd!");
    expect(first).not.toBe(second);
  });
});

describe("verifyPassword", () => {
  it("returns true for the correct password", async () => {
    const hash = await hashPassword("Passw0rd!");
    await expect(verifyPassword("Passw0rd!", hash)).resolves.toBe(true);
  });

  it("returns false for a wrong password", async () => {
    const hash = await hashPassword("Passw0rd!");
    await expect(verifyPassword("WrongPass1", hash)).resolves.toBe(false);
  });
});

// Login compares against DUMMY_HASH when the email is unknown, so the response time looks the same.
// If DUMMY_HASH ever stopped being a real bcrypt hash at the same cost, that timing defense would
// quietly disappear, so these tests pin its shape and its behavior.
describe("DUMMY_HASH (timing defense for unknown emails)", () => {
  it("is a bcrypt hash at the same cost factor as real hashes", () => {
    expect(DUMMY_HASH).toMatch(/^\$2[aby]\$12\$/);
  });

  it.each(["Passw0rd!", "", "anything-at-all-1", "x".repeat(72)])(
    "never verifies, for input %j",
    async (input) => {
      await expect(verifyPassword(input, DUMMY_HASH)).resolves.toBe(false);
    },
  );
});
