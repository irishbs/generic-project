// Shared test data. Each test creates its own accounts, so tests don't depend on each other.

import { randomUUID } from "node:crypto";

export const PASSWORD = "Passw0rd!";

// A unique, valid email for each call. The random part must be unique across processes: the API
// and UI suites run as separate worker processes at the same time, and a per-process counter plus
// the clock can repeat in the same millisecond.
export function uniqueEmail(label = "user"): string {
  return `${label}-${randomUUID()}@example.com`;
}
