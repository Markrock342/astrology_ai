#!/usr/bin/env node
/**
 * Refuse to auto-apply a migration that can destroy data or break the running
 * app mid-deploy.
 *
 * Applying migrations during the build is what stops a teammate's migration from
 * being silently skipped — the failure mode there is brutal: Prisma selects a
 * column the database doesn't have and production 500s on the next request. But
 * automation cuts both ways, and an unreviewed `DROP TABLE` would then also
 * apply itself, to the live database, at 3am.
 *
 * So: additive migrations flow through untouched, and anything dangerous has to
 * say so out loud, in the file, on purpose:
 *
 *   -- ALLOW_DESTRUCTIVE: dropping legacy_foo, empty since the M4 backfill
 *
 * That line cannot be written by accident, it shows up in the diff, and
 * CODEOWNERS puts a human in front of it.
 *
 * The rules live in isDestructive() and are unit-tested (tests/check-migrations.test.ts)
 * — a guard nobody tests is a guard nobody can trust.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

/** Comments describe; they don't execute. Don't fail on the word "DROP" in prose. */
export function stripComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
}

/**
 * Why each rule is here:
 *
 * - DROP TABLE/SCHEMA/DATABASE, TRUNCATE, DELETE FROM — data is gone.
 * - ALTER TABLE … DROP … — drops a column. Postgres lets you OMIT the COLUMN
 *   keyword (`ALTER TABLE t DROP "c";`), so matching /DROP\s+COLUMN/ alone is a
 *   hole you can drive a table through. Relaxing constraints (DROP NOT NULL,
 *   DROP DEFAULT) is safe and stays allowed.
 * - RENAME — the OLD code is still serving traffic while the migration runs.
 *   Rename a column out from under it and every request referencing it fails.
 * - ALTER COLUMN … TYPE — silently coerces, or fails outright, on existing rows.
 * - SET NOT NULL — fails on a populated table with any NULL. A failed migration
 *   in the build means no deploy, which is at least loud; a *succeeding* one
 *   that mangles data is worse.
 * - UPDATE … SET — a data backfill. Might be perfectly correct; must be read.
 */
const RULES = [
  { name: "DROP TABLE", re: /\bDROP\s+TABLE\b/i },
  { name: "DROP SCHEMA", re: /\bDROP\s+SCHEMA\b/i },
  { name: "DROP DATABASE", re: /\bDROP\s+DATABASE\b/i },
  { name: "TRUNCATE", re: /\bTRUNCATE\b/i },
  { name: "DELETE FROM", re: /\bDELETE\s+FROM\b/i },
  { name: "UPDATE … SET (data backfill)", re: /\bUPDATE\b[\s\S]+?\bSET\b/i },
  { name: "ALTER COLUMN … TYPE", re: /\bALTER\s+COLUMN\b[\s\S]*?\bTYPE\b/i },
  { name: "SET NOT NULL", re: /\bSET\s+NOT\s+NULL\b/i },
  { name: "RENAME (breaks the running app mid-deploy)", re: /\bRENAME\b/i },
  {
    name: "ALTER TABLE … DROP (column)",
    test: (sql) =>
      /\bALTER\s+TABLE\b/i.test(sql) &&
      /\bDROP\b/i.test(sql) &&
      // Relaxing a constraint is not destruction.
      !/\bDROP\s+(NOT\s+NULL|DEFAULT)\b/i.test(sql),
  },
];

/** @returns {string[]} names of the rules this SQL trips. Empty = safe. */
export function isDestructive(rawSql) {
  const sql = stripComments(rawSql);
  // Statement-level, so `DROP NOT NULL` in one statement cannot excuse a
  // `DROP COLUMN` in another.
  const statements = sql.split(";").filter((s) => s.trim());

  const hits = new Set();
  for (const stmt of statements) {
    for (const rule of RULES) {
      const tripped = rule.test ? rule.test(stmt) : rule.re.test(stmt);
      if (tripped) hits.add(rule.name);
    }
  }
  return [...hits];
}

const OPT_OUT = /--\s*ALLOW_DESTRUCTIVE:\s*\S+/i;

export function checkMigrations(dir = "prisma/migrations") {
  if (!existsSync(dir)) return [];

  const offenders = [];
  for (const entry of readdirSync(dir)) {
    const file = join(dir, entry, "migration.sql");
    if (!existsSync(file)) continue;

    const raw = readFileSync(file, "utf8");
    // The opt-out is read from the RAW file — it lives in a comment.
    if (OPT_OUT.test(raw)) continue;

    const hits = isDestructive(raw);
    if (hits.length > 0) offenders.push({ file, hits });
  }
  return offenders;
}

// Only run when invoked directly, so the tests can import the rules.
if (process.argv[1] && process.argv[1].endsWith("check-migrations.mjs")) {
  const offenders = checkMigrations();

  if (offenders.length > 0) {
    console.error(
      "\n✗ This migration would be auto-applied to PRODUCTION and can destroy data\n" +
        "  or break the app that is still serving traffic while it runs:\n",
    );
    for (const { file, hits } of offenders) {
      console.error(`  ${file}`);
      for (const h of hits) console.error(`      ${h}`);
    }
    console.error(
      "\nIf this is intentional and you have checked it against live data, say so in\n" +
        "the migration file and it will be allowed through:\n\n" +
        "  -- ALLOW_DESTRUCTIVE: <why this is safe>\n",
    );
    process.exit(1);
  }

  console.log("✓ migrations are additive (or explicitly cleared)");
}
