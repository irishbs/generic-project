import cookieParser from "cookie-parser";
import express, { type NextFunction, type Request, type Response } from "express";
import { authRouter, type AuthDeps } from "./auth/routes.js";
import { mountDocs } from "./docs.js";

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

  if (deps.enableDocs) {
    mountDocs(app);
  }

  app.use("/api/auth", authRouter(deps));

  // Turns malformed JSON into a 400 and any other unexpected error into a generic 500.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if ((err as { type?: string }).type === "entity.parse.failed") {
      return res.status(400).json({ error: "request body is not valid JSON" });
    }
    console.error(err);
    return res.status(500).json({ error: "internal server error" });
  });

  return app;
}
