import { rmSync } from "node:fs";

// Runs once after the whole run. Removes this run's database and its SQLite side files.
export default function cleanupDatabase(): void {
  const runId = process.env.E2E_RUN_ID;
  if (!runId) return;
  const base = `data/e2e-${runId}.sqlite`;
  for (const suffix of ["", "-wal", "-shm"]) {
    rmSync(base + suffix, { force: true });
  }
}
