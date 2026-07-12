#!/usr/bin/env node
/**
 * Push selected .env variables to Vercel Production (idempotent via --force).
 *
 * NEVER syncs SEED_* or other local-only secrets. Uses an allowlist.
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

/** Keys that may be pushed to Vercel production. Everything else is ignored. */
const ALLOWLIST = new Set([
  "DATABASE_URL",
  "DIRECT_URL",
  "AUTH_SECRET",
  "AUTH_URL",
  "APP_BASE_URL",
  "AUTH_GOOGLE_ID",
  "AUTH_GOOGLE_SECRET",
  "GEMINI_API_KEY",
  "OPENAI_API_KEY",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "TURNSTILE_SECRET_KEY",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "NEXT_PUBLIC_APP_PHASE",
  "BLOB_READ_WRITE_TOKEN",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "ADMIN_ALERT_EMAIL",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
  "VAPID_SUBJECT",
  "ENABLE_MYHORA_SCRAPE",
  "MYHORA_ORIGIN",
  "MYHORA_SCRAPE_TIMEOUT_MS",
  "NODE_ENV",
]);

const BLOCK_PREFIXES = ["SEED_"];

const OVERRIDES = {
  AUTH_URL: productionUrl,
  APP_BASE_URL: productionUrl,
  NEXT_PUBLIC_APP_PHASE: "3",
  NODE_ENV: "production",
};

/** @type {Record<string, string>} */
const vars = {};

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
    if (!value) continue;
    if (BLOCK_PREFIXES.some((p) => key.startsWith(p))) continue;
    if (!ALLOWLIST.has(key)) continue;
    vars[key] = value;
  }
}

Object.assign(vars, OVERRIDES);

const keys = Object.keys(vars).sort();
console.log(`Syncing ${keys.length} allowlisted env vars to Vercel (production)…`);
console.log(`Production URL: ${productionUrl}`);
console.log(`(SEED_* and non-allowlisted keys are never pushed)\n`);

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
