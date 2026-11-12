import { readFileSync } from "node:fs";
import type { Express } from "express";
import swaggerUi from "swagger-ui-express";
import { parse } from "yaml";

// Reads openapi.yaml from the project root. This works from src/ with tsx and from dist/ later.
export function loadOpenApiSpec(): Record<string, unknown> {
  const path = new URL("../openapi.yaml", import.meta.url);
  return parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

// Serves Swagger UI at /api/docs and the raw spec at /api/openapi.json.
export function mountDocs(app: Express): void {
  const spec = loadOpenApiSpec();
  app.get("/api/openapi.json", (_req, res) => {
    res.json(spec);
  });
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(spec));
}
