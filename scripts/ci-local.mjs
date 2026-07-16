#!/usr/bin/env node
/**
 * Local / Vercel stand-in for .github/workflows/ci.yml "check" job.
 * Node (not bash) so Windows checkouts with CRLF cannot break the gate.
 */
import { spawnSync } from "node:child_process";

process.env.DATABASE_URL ??= "postgresql://ci:ci@localhost:5432/ci";
process.env.AUTH_SECRET ??= "ci-placeholder-not-a-real-secret";

function run(label, cmd, args) {
  console.log(`==> ${label}`);
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

// Best-effort: Windows may lock the query engine while `next dev` is running.
console.log("==> prisma generate");
const gen = spawnSync("npx", ["prisma", "generate"], {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});
if (gen.status !== 0) {
  console.warn("==> prisma generate failed (continuing if client already exists)");
}

run("typecheck", "npx", ["tsc", "--noEmit"]);
run("lint", "npx", ["eslint", "src", "e2e"]);
run("unit tests", "npx", ["vitest", "run"]);

console.log("==> CI check OK");
