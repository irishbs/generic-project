import { describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { TOKEN_TTL_SECONDS, issueToken, toKey, verifyToken } from "../../src/auth/tokens.js";

const SECRET = "a".repeat(32);
const OTHER_SECRET = "b".repeat(32);
const key = toKey(SECRET);

describe("issueToken and verifyToken", () => {
  it("round-trips the user id and token id", async () => {
    const issued = await issueToken(key, "user-123");
    const verified = await verifyToken(key, issued.token);

    expect(verified.userId).toBe("user-123");
    expect(verified.jti).toBe(issued.jti);
    expect(verified.expiresAt).toBe(issued.expiresAt);
  });

  it("sets expiry one TTL after issue", async () => {
    const before = Math.floor(Date.now() / 1000);
    const issued = await issueToken(key, "user-123");
    expect(issued.expiresAt).toBeGreaterThanOrEqual(before + TOKEN_TTL_SECONDS);
    expect(issued.expiresAt).toBeLessThanOrEqual(before + TOKEN_TTL_SECONDS + 2);
  });

  it("gives each token a unique id", async () => {
    const a = await issueToken(key, "user-123");
    const b = await issueToken(key, "user-123");
    expect(a.jti).not.toBe(b.jti);
  });

  it("rejects a token signed with a different secret", async () => {
    const issued = await issueToken(toKey(OTHER_SECRET), "user-123");
    await expect(verifyToken(key, issued.token)).rejects.toThrow();
  });

  it("rejects a token whose payload was changed", async () => {
    const issued = await issueToken(key, "user-123");
    const [header, , signature] = issued.token.split(".");
    // Swap in a payload claiming a different user, keeping the original signature.
    const forgedPayload = Buffer.from(
      JSON.stringify({ sub: "admin", jti: issued.jti, exp: issued.expiresAt }),
    ).toString("base64url");
    await expect(verifyToken(key, `${header}.${forgedPayload}.${signature}`)).rejects.toThrow();
  });

  it("rejects an expired token", async () => {
    const past = Math.floor(Date.now() / 1000) - 60;
    const expired = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-123")
      .setJti("expired-jti")
      .setIssuedAt(past - 3600)
      .setExpirationTime(past)
      .sign(key);
    await expect(verifyToken(key, expired)).rejects.toThrow();
  });

  it("rejects an unsigned 'alg: none' token", async () => {
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        sub: "admin",
        jti: "forged",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url");
    await expect(verifyToken(key, `${header}.${payload}.`)).rejects.toThrow();
  });

  it("rejects a validly signed token that uses a different HMAC algorithm", async () => {
    // Same secret, valid signature, but HS512 instead of our allowed HS256.
    // Only our explicit algorithm allowlist can reject this one.
    const hs512 = await new SignJWT({})
      .setProtectedHeader({ alg: "HS512" })
      .setSubject("user-123")
      .setJti("hs512-jti")
      .setExpirationTime("1h")
      .sign(key);
    await expect(verifyToken(key, hs512)).rejects.toThrow();
  });

  it("rejects a token missing the subject claim", async () => {
    const noSubject = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setJti("no-sub")
      .setExpirationTime("1h")
      .sign(key);
    await expect(verifyToken(key, noSubject)).rejects.toThrow("missing required claims");
  });

  it("rejects garbage input", async () => {
    await expect(verifyToken(key, "not-a-jwt")).rejects.toThrow();
  });
});
