import { randomUUID } from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import type { Db } from "../db.js";
import { DUMMY_HASH, hashPassword, verifyPassword } from "./password.js";
import { TOKEN_TTL_SECONDS, issueToken, toKey, verifyToken } from "./tokens.js";
import { validateEmail, validatePassword } from "./validation.js";

export const SESSION_COOKIE = "session";

export interface AuthDeps {
  db: Db;
  jwtSecret: string;
  cookieSecure: boolean;
}

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
}

export function authRouter({ db, jwtSecret, cookieSecure }: AuthDeps): Router {
  const key = toKey(jwtSecret);
  const router = Router();

  const cookieOptions = {
    httpOnly: true, // JavaScript on the page cannot read the cookie (limits XSS damage)
    sameSite: "strict" as const, // browsers won't send it on cross-site requests (limits CSRF)
    secure: cookieSecure,
    path: "/",
    maxAge: TOKEN_TTL_SECONDS * 1000,
  };

  // Middleware: rejects the request with 401 unless it has a valid, unrevoked session cookie.
  async function requireAuth(req: Request, res: Response, next: NextFunction) {
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    if (typeof token !== "string") {
      return res.status(401).json({ error: "not logged in" });
    }
    try {
      const verified = await verifyToken(key, token);
      const revoked = db.prepare("SELECT 1 FROM revoked_tokens WHERE jti = ?").get(verified.jti);
      if (revoked) {
        return res.status(401).json({ error: "session has been logged out" });
      }
      res.locals.auth = verified;
      return next();
    } catch {
      return res.status(401).json({ error: "invalid or expired session" });
    }
  }

  router.post("/register", async (req, res) => {
    const body = req.body ?? {};
    const emailError = validateEmail(body.email);
    const passwordError = validatePassword(body.password);
    if (emailError || passwordError) {
      return res.status(400).json({ error: emailError ?? passwordError });
    }

    const email = (body.email as string).trim().toLowerCase();
    const id = randomUUID();
    const hash = await hashPassword(body.password as string);

    try {
      db.prepare("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)").run(
        id,
        email,
        hash,
      );
    } catch (err) {
      // The UNIQUE constraint on email catches duplicates even when two requests race.
      if ((err as { code?: string }).code === "SQLITE_CONSTRAINT_UNIQUE") {
        return res.status(409).json({ error: "email already registered" });
      }
      throw err;
    }

    return res.status(201).json({ id, email });
  });

  router.post("/login", async (req, res) => {
    const body = req.body ?? {};
    if (typeof body.email !== "string" || typeof body.password !== "string") {
      return res.status(400).json({ error: "email and password are required" });
    }

    const email = body.email.trim().toLowerCase();
    const user = db
      .prepare("SELECT id, email, password_hash FROM users WHERE email = ?")
      .get(email) as UserRow | undefined;

    // Always run one bcrypt comparison, so timing doesn't reveal whether the email exists.
    const passwordMatches = await verifyPassword(body.password, user?.password_hash ?? DUMMY_HASH);
    if (!user || !passwordMatches) {
      return res.status(401).json({ error: "invalid email or password" });
    }

    const issued = await issueToken(key, user.id);
    res.cookie(SESSION_COOKIE, issued.token, cookieOptions);
    return res.status(200).json({ id: user.id, email: user.email });
  });

  router.post("/logout", requireAuth, (_req, res) => {
    const { jti, expiresAt } = res.locals.auth as { jti: string; expiresAt: number };
    db.prepare("INSERT OR IGNORE INTO revoked_tokens (jti, expires_at) VALUES (?, ?)").run(
      jti,
      expiresAt,
    );
    res.clearCookie(SESSION_COOKIE, { ...cookieOptions, maxAge: undefined });
    return res.status(204).end();
  });

  router.get("/me", requireAuth, (_req, res) => {
    const { userId } = res.locals.auth as { userId: string };
    const user = db.prepare("SELECT id, email FROM users WHERE id = ?").get(userId) as
      { id: string; email: string } | undefined;
    if (!user) {
      return res.status(401).json({ error: "account no longer exists" });
    }
    return res.status(200).json(user);
  });

  return router;
}
