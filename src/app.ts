import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import express, { type NextFunction, type Request, type Response } from "express";
import { authRouter, type AuthDeps } from "./auth/routes.js";
import { mountDocs } from "./docs.js";

// The login UI pages and their scripts and styles, served from the public/ folder.
const PUBLIC_DIR = fileURLToPath(new URL("../public", import.meta.url));

export interface AppDeps extends AuthDeps {
  // Swagger UI and the raw spec. Off in production so the API's shape isn't published by default.
  enableDocs: boolean;
}

// Builds the Express app without starting a server. Tests call this with an in-memory database.
export function createApp(deps: AppDeps) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "10kb" }));
  app.use(cookieParser());

  // extensions: "/login" serves login.html, and "/" serves index.html.
  app.use(express.static(PUBLIC_DIR, { extensions: ["html"] }));

  if (deps.enableDocs) {
    mountDocs(app);
  }

  app.use("/api/auth", authRouter(deps));

  // Maps known body-parsing errors to 400 and 413, and any other unexpected error to a generic 500.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const type = (err as { type?: string }).type;
    if (type === "entity.parse.failed") {
      return res.status(400).json({ error: "request body is not valid JSON" });
    }
    if (type === "entity.too.large") {
      return res.status(413).json({ error: "request body is too large" });
    }
    console.error(err);
    return res.status(500).json({ error: "internal server error" });
  });

  return app;
}
