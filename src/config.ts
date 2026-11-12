// Reads all settings from environment variables in one place.
// Every other module receives config as a parameter instead of reading process.env directly.

export interface Config {
  port: number;
  jwtSecret: string;
  databasePath: string;
  cookieSecure: boolean;
  enableDocs: boolean;
}

// The placeholder from .env.example. Refusing to run with it stops an accidental deploy
// that signs tokens with a publicly known secret.
const PLACEHOLDER_SECRET = "change-me-to-a-long-random-string";

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const jwtSecret = env.JWT_SECRET ?? "";
  if (jwtSecret.length < 32) {
    throw new Error("JWT_SECRET must be set to at least 32 characters. See .env.example.");
  }
  if (jwtSecret === PLACEHOLDER_SECRET) {
    throw new Error("JWT_SECRET is still the placeholder from .env.example. Replace it.");
  }

  return {
    port: Number(env.PORT ?? 3000),
    jwtSecret,
    databasePath: env.DATABASE_PATH ?? "./data/app.sqlite",
    // Secure cookies are only sent over HTTPS. Local development uses plain HTTP.
    cookieSecure: env.NODE_ENV === "production",
    // Swagger UI is for development and testing. It's off in production unless turned on explicitly.
    enableDocs: env.NODE_ENV !== "production",
  };
}
