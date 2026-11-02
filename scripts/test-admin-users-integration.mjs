import { spawnSync } from "node:child_process";
const raw = process.env.DATABASE_URL;
if (!raw) throw new Error("Set DATABASE_URL to a local hora_admin_filter_test database");
const target = new URL(raw);
if (!["127.0.0.1", "localhost"].includes(target.hostname)
  || !/^\/hora_admin_filter_test(?:_[a-zA-Z0-9_-]+)?$/.test(target.pathname)
  || [...target.searchParams.keys()].some((key) => !["schema", "connection_limit", "pool_timeout"].includes(key))) {
  throw new Error("Refusing integration migrations outside a local hora_admin_filter_test database");
}
// Prisma CLI prefers DIRECT_URL, including values loaded from .env. Pin both.
const env = { ...process.env, DATABASE_URL: raw, DIRECT_URL: raw, AUTH_SECRET: "local-admin-filter-test-only", NODE_ENV: "test" };
for (const args of [
  ["node_modules/prisma/build/index.js", "migrate", "deploy"],
  ["node_modules/vitest/vitest.mjs", "run", "--config", "vitest.admin-users.config.ts"],
]) {
  const run = spawnSync(process.execPath, args, { env, stdio: "inherit" });
  if (run.status !== 0) process.exit(run.status ?? 1);
}
