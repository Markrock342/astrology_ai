#!/usr/bin/env node
/** @deprecated Use `tsx scripts/check-migrations.ts` (npm run migrations:check). */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
const result = spawnSync(
  process.execPath,
  ["--import", "tsx", join(dir, "check-migrations.ts")],
  { stdio: "inherit", shell: process.platform === "win32" },
);
process.exit(result.status ?? 1);
