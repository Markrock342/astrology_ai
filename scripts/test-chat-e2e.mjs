// Real credentials login and chat UI against an isolated PostgreSQL database.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { sourceFingerprint } from "./source-fingerprint.mjs";

const raw = process.env.DATABASE_URL;
const target = new URL(raw || "postgresql://invalid/invalid");
if (!["127.0.0.1", "localhost"].includes(target.hostname)
  || !/^\/hora_chat_test(?:_[a-zA-Z0-9_-]+)?$/.test(target.pathname)
  || [...target.searchParams.keys()].some(k => !["schema", "connection_limit", "pool_timeout"].includes(k))) {
  throw new Error("Refusing chat E2E outside an isolated local hora_chat_test database");
}
if (existsSync(".next/dev/lock") || existsSync(".next/lock")) throw new Error("Stop existing Next dev/build before isolated chat E2E");
await mkdir("output/chat-ui-tests", { recursive: true });
const log = createWriteStream("output/chat-ui-tests/next-server.log", { mode: 0o600 });
const portServer = createServer();
await new Promise(resolve => portServer.listen(0, "127.0.0.1", resolve));
const port = portServer.address().port;
await new Promise(resolve => portServer.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const id = `chat-e2e-${randomUUID()}`;
const env = {
  ...process.env,
  NODE_ENV: "production", DATABASE_URL: raw, DIRECT_URL: raw,
  AUTH_SECRET: randomUUID() + randomUUID(), AUTH_URL: origin, NEXTAUTH_URL: origin,
  APP_BASE_URL: origin, AUTH_TRUST_HOST: "true", INTERNAL_SCHEDULER: "off",
  E2E_BASE_URL: origin, E2E_EMAIL: `${id}@example.invalid`, E2E_PASSWORD: randomUUID(),
  E2E_THREAD_ID: `${id}-thread`, E2E_USER_MSG_ID: `${id}-question`, E2E_ASSISTANT_MSG_ID: `${id}-answer`,
  UPSTASH_REDIS_REST_URL: "https://redis-disabled.invalid", UPSTASH_REDIS_REST_TOKEN: "",
  AUTH_RATELIMIT_STRICT: "false", TURNSTILE_SECRET_KEY: "",
  AUTH_GOOGLE_ID: "", AUTH_GOOGLE_SECRET: "", RESEND_API_KEY: "", RESEND_WEBHOOK_SECRET: "",
  GEMINI_API_KEY: "", OPENAI_API_KEY: "", AI_SECRET_ENC_KEY: "", BLOB_READ_WRITE_TOKEN: "",
  SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "",
  VAPID_PRIVATE_KEY: "", VAPID_PUBLIC_KEY: "", NEXT_TELEMETRY_DISABLED: "1",
};
const db = new PrismaClient({ datasources: { db: { url: raw } } });
let server;
async function run(args, output = "inherit") {
  const child = spawn(process.execPath, args, { env, stdio: output === "log" ? ["ignore", "pipe", "pipe"] : "inherit" });
  if (output === "log") { child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false }); }
  await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", code => code === 0 ? resolve() : reject(new Error(`${args[0]} exited ${code}; inspect output/chat-ui-tests`)));
  });
}
try {
  // Pin BOTH URLs: Prisma CLI would otherwise read a stale DIRECT_URL from .env.
  await run(["node_modules/prisma/build/index.js", "migrate", "deploy"]);
  const free = await db.package.upsert({ where: { code: "FREE" }, create: { code: "FREE", name: "Free", type: "FREE", creditQuota: 50, usageBudgetUnits: 750000 }, update: {} });
  const category = await db.horoscopeCategory.upsert({ where: { slug: "self" }, create: { slug: "self", nameTh: "ตัวตน", accessLevel: "FREE" }, update: {} });
  await db.user.create({ data: {
    id, email: env.E2E_EMAIL, name: "Chat Regression", passwordHash: await bcrypt.hash(env.E2E_PASSWORD, 10), emailVerifiedAt: new Date(),
    birthProfile: { create: { birthDate: new Date("1990-01-01T00:00:00Z"), birthTime: "12:00", birthProvince: "กรุงเทพมหานคร", birthDistrict: "พระนคร" } },
    creditWallet: { create: { balance: 50 } },
    usageWallet: { create: { includedBalanceUnits: 750000, includedAllowanceUnits: 750000 } },
    subscriptions: { create: { packageId: free.id, status: "ACTIVE" } },
  } });
  await db.conversation.create({ data: {
    id: env.E2E_THREAD_ID, userId: id, categoryId: category.id, title: "Chat regression fixture",
    messages: { create: [
      { id: env.E2E_USER_MSG_ID, role: "USER", content: "คำถามทดสอบ" },
      { id: env.E2E_ASSISTANT_MSG_ID, role: "ASSISTANT", content: "นี่คือคำตอบทดสอบจากระบบ" },
    ] },
  } });
  const reuse = process.env.CI !== "true" && process.env.CHAT_E2E_REUSE_BUILD === "1";
  if (!reuse) await run(["node_modules/next/dist/bin/next", "build", ...(process.env.CI === "true" ? [] : ["--webpack"])], "log");
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], { env, detached: true, stdio: ["ignore", "pipe", "pipe"] });
  server.stdout.pipe(log, { end: false }); server.stderr.pipe(log, { end: false });
  let version;
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error("Next test server exited");
    try { const r = await fetch(origin + "/api/version", { signal: AbortSignal.timeout(2000) }); if (r.ok) { version = await r.json(); break; } } catch {}
    await delay(500);
  }
  assert.equal(version?.source, sourceFingerprint(), "Chat E2E requires a running production bundle matching current source");
  await run(["node_modules/@playwright/test/cli.js", "test"]);
  const feedback = await db.messageFeedback.findUniqueOrThrow({ where: { messageId_userId: { messageId: env.E2E_ASSISTANT_MSG_ID, userId: id } } });
  assert.equal(feedback.value, "DOWN", "UI feedback must actually persist in PostgreSQL");
  console.log("PASS actual login/session/protected API and persisted chat feedback");
} finally {
  if (server && server.exitCode === null) {
    process.kill(-server.pid, "SIGTERM");
    await Promise.race([new Promise(resolve => server.once("exit", resolve)), delay(5000)]);
    if (server.exitCode === null) process.kill(-server.pid, "SIGKILL");
  }
  await db.user.deleteMany({ where: { id } });
  await db.$disconnect();
  await rm("e2e/.auth/user.json", { force: true });
  log.end();
}
