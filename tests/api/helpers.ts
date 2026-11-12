// Shared test data. Each test creates its own accounts, so tests don't depend on each other.

export const PASSWORD = "Passw0rd!";

let counter = 0;

// A unique, valid email for each call: alice-<time>-<counter>@example.com
export function uniqueEmail(label = "user"): string {
  counter += 1;
  return `${label}-${Date.now()}-${counter}@example.com`;
}
