#!/usr/bin/env node
/**
 * Post-deploy smoke check for public (unauthenticated) API routes.
 *
 * Usage:
 *   SMOKE_BASE_URL=https://your-app.vercel.app npm run smoke:public
 *   npm run smoke:public   # defaults to http://localhost:3000
 */

const base = (process.env.SMOKE_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

const endpoints = [
  { path: "/api/packages", expectOk: true },
  { path: "/api/geo/thailand", expectOk: true },
  { path: "/api/faq", expectOk: true },
  { path: "/api/settings/public", expectOk: true },
  { path: "/api/announcements", expectOk: true },
];

async function check({ path, expectOk }) {
  const url = `${base}${path}`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    const json = await res.json().catch(() => null);
    const ok = res.ok && json && json.ok === expectOk;
    return { path, ok, status: res.status, bodyOk: json?.ok };
  } catch (err) {
    return {
      path,
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function main() {
  console.log(`Smoke public APIs @ ${base}\n`);
  const results = await Promise.all(endpoints.map(check));
  let failed = 0;

  for (const r of results) {
    if (r.ok) {
      console.log(`  OK  ${r.path} (${r.status})`);
    } else {
      failed += 1;
      console.error(
        `  FAIL ${r.path} status=${r.status} body.ok=${r.bodyOk ?? "n/a"}${r.error ? ` err=${r.error}` : ""}`,
      );
    }
  }

  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
