import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

// Checks that openapi.yaml documents the endpoints and status codes the API actually uses.
// The status codes listed here match the ones asserted in auth.test.ts.

const doc = parse(readFileSync(join(process.cwd(), "openapi.yaml"), "utf8"));

const EXPECTED: Record<string, Record<string, string[]>> = {
  "/api/auth/register": { post: ["201", "400", "409"] },
  "/api/auth/login": { post: ["200", "400", "401"] },
  "/api/auth/logout": { post: ["204", "401"] },
  "/api/auth/me": { get: ["200", "401"] },
};

describe("openapi.yaml", () => {
  it("is valid OpenAPI 3.x with a title and version", () => {
    expect(doc.openapi).toMatch(/^3\./);
    expect(doc.info.title).toBeTruthy();
    expect(doc.info.version).toBeTruthy();
  });

  it.each(Object.entries(EXPECTED))(
    "documents %s with the expected methods and status codes",
    (path, methods) => {
      for (const [method, codes] of Object.entries(methods)) {
        const operation = doc.paths[path]?.[method];
        expect(operation, `${method.toUpperCase()} ${path} is missing`).toBeDefined();
        expect(Object.keys(operation.responses).sort()).toEqual([...codes].sort());
      }
    },
  );

  it("documents no paths beyond the ones the API implements", () => {
    expect(Object.keys(doc.paths).sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  it("declares the session cookie security scheme used by logout and me", () => {
    expect(doc.components.securitySchemes.sessionCookie).toEqual({
      type: "apiKey",
      in: "cookie",
      name: "session",
    });
  });
});
