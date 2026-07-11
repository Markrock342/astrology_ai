#!/usr/bin/env node
/**
 * Push .env variables to Vercel Production (idempotent via --force).
 *
 * Usage:
 *   PRODUCTION_URL=https://horaai.vercel.app npm run deploy:env
 *   npm run deploy:env
 */

import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env");
const productionUrl = (
  process.env.PRODUCTION_URL ?? "https://horaai.vercel.app"
).replace(/\/$/, "");

const OVERRIDES = {
  AUTH_URL: productionUrl,
  APP_BASE_URL: productionUrl,
  NEXT_PUBLIC_APP_PHASE: "3",
  NODE_ENV: "production",
};

/** @type {Record<string, string>} */
const vars = { ...OVERRIDES };

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value) vars[key] = value;
  }
}

// Overrides win over .env
Object.assign(vars, OVERRIDES);

const keys = Object.keys(vars).sort();
console.log(`Syncing ${keys.length} env vars to Vercel (production)…`);
console.log(`Production URL: ${productionUrl}\n`);

let ok = 0;
let failed = 0;

for (const key of keys) {
  const value = vars[key];
  try {
    execSync(`npx vercel env add ${key} production --force`, {
      input: value,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      shell: true,
    });
    console.log(`  ✓ ${key}`);
    ok += 1;
  } catch (err) {
    failed += 1;
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ✗ ${key}: ${msg.split("\n")[0]}`);
  }
}

console.log(`\n${ok}/${keys.length} synced${failed ? ` (${failed} failed)` : ""}`);
if (failed > 0) process.exit(1);
