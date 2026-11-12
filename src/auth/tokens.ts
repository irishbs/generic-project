import { randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

// Only HS256 is accepted. Refusing other algorithms blocks the "alg: none" attack.
const ALGORITHM = "HS256";
export const TOKEN_TTL_SECONDS = 60 * 60; // one hour

export interface IssuedToken {
  token: string;
  jti: string;
  expiresAt: number; // Unix seconds
}

export interface VerifiedToken {
  userId: string;
  jti: string;
  expiresAt: number;
}

export function toKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function issueToken(key: Uint8Array, userId: string): Promise<IssuedToken> {
  // jti (JWT ID) is a unique id for this token. Logout stores it to revoke the token.
  const jti = randomUUID();
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(userId)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(key);
  const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  return { token, jti, expiresAt };
}

// Throws if the signature is wrong, the token is expired, or the algorithm isn't HS256.
export async function verifyToken(key: Uint8Array, token: string): Promise<VerifiedToken> {
  const { payload } = await jwtVerify(token, key, { algorithms: [ALGORITHM] });
  if (typeof payload.sub !== "string" || typeof payload.jti !== "string" || !payload.exp) {
    throw new Error("token is missing required claims");
  }
  return { userId: payload.sub, jti: payload.jti, expiresAt: payload.exp };
}
