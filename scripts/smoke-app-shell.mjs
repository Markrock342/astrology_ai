#!/usr/bin/env node
/**
 * Authenticated app-shell smoke (local dev).
 *
 * Usage:
 *   SMOKE_BASE_URL=http://localhost:3000 \
 *   SMOKE_ADMIN_EMAIL=admin@horasard.local \
 *   SMOKE_ADMIN_PASSWORD=... \
 *   node scripts/smoke-app-shell.mjs
 */

const base = (process.env.SMOKE_BASE_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);
const email = process.env.SMOKE_ADMIN_EMAIL ?? process.env.SEED_ADMIN_EMAIL;
const password = process.env.SMOKE_ADMIN_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD;

function cookieHeader(res) {
  const raw =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : [];
  if (raw.length > 0) {
    return raw.map((c) => c.split(";")[0]).join("; ");
  }
  const single = res.headers.get("set-cookie");
  return single ? single.split(";")[0] : "";
}

async function jsonFetch(path, { method = "GET", body, cookies } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookies ? { Cookie: cookies } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { res, json, cookies: cookieHeader(res) || cookies };
}

async function main() {
  if (!email || !password) {
    console.error(
      "Set SMOKE_ADMIN_EMAIL + SMOKE_ADMIN_PASSWORD (or SEED_ADMIN_* from .env)",
    );
    process.exit(1);
  }

  console.log(`Smoke app shell @ ${base}\n`);
  let failed = 0;

  const login = await jsonFetch("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
  const sessionCookie = login.cookies;
  if (!login.res.ok || !login.json?.ok || !sessionCookie) {
    console.error("  FAIL login", login.res.status, login.json);
    process.exit(1);
  }
  console.log("  OK  POST /api/auth/login");

  const checks = [
    { path: "/api/app/bootstrap", label: "bootstrap" },
    { path: "/api/me/usage?view=summary", label: "usage summary" },
    { path: "/api/conversations?mode=NATAL", label: "natal threads" },
  ];

  for (const { path, label } of checks) {
    const { res, json } = await jsonFetch(path, { cookies: sessionCookie });
    if (res.ok && json?.ok) {
      console.log(`  OK  GET ${path}`);
    } else {
      failed += 1;
      console.error(`  FAIL GET ${path} status=${res.status} body.ok=${json?.ok}`);
    }
  }

  const create = await jsonFetch("/api/conversations", {
    method: "POST",
    cookies: sessionCookie,
    body: { categorySlug: "self", mode: "NATAL" },
  });
  const threadId = create.json?.data?.id;
  if (!create.res.ok || !threadId) {
    failed += 1;
    console.error("  FAIL POST /api/conversations", create.res.status);
  } else {
    console.log(`  OK  POST /api/conversations → ${threadId}`);

    const del = await jsonFetch(`/api/conversations/${threadId}`, {
      method: "DELETE",
      cookies: sessionCookie,
    });
    if (del.res.ok && del.json?.ok) {
      console.log(`  OK  DELETE /api/conversations/${threadId}`);
    } else {
      failed += 1;
      console.error(`  FAIL DELETE thread status=${del.res.status}`);
    }
  }

  console.log(`\n${checks.length + 2 - failed}/${checks.length + 2} core checks passed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
