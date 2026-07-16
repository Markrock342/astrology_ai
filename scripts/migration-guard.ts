import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Comments describe; they don't execute. Don't fail on the word "DROP" in prose. */
export function stripComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
}

type DestructiveRule = {
  name: string;
  re?: RegExp;
  test?: (sql: string) => boolean;
};

const RULES: DestructiveRule[] = [
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
      !/\bDROP\s+(NOT\s+NULL|DEFAULT)\b/i.test(sql),
  },
];

/** @returns names of the rules this SQL trips. Empty = safe. */
export function isDestructive(rawSql: string): string[] {
  const sql = stripComments(rawSql);
  const statements = sql.split(";").filter((s) => s.trim());

  const hits = new Set<string>();
  for (const stmt of statements) {
    for (const rule of RULES) {
      const tripped = rule.test ? rule.test(stmt) : rule.re!.test(stmt);
      if (tripped) hits.add(rule.name);
    }
  }
  return [...hits];
}

const OPT_OUT = /--\s*ALLOW_DESTRUCTIVE:\s*\S+/i;

export type MigrationOffender = { file: string; hits: string[] };

export function checkMigrations(dir = "prisma/migrations"): MigrationOffender[] {
  if (!existsSync(dir)) return [];

  const offenders: MigrationOffender[] = [];
  for (const entry of readdirSync(dir)) {
    const file = join(dir, entry, "migration.sql");
    if (!existsSync(file)) continue;

    const raw = readFileSync(file, "utf8");
    if (OPT_OUT.test(raw)) continue;

    const hits = isDestructive(raw);
    if (hits.length > 0) offenders.push({ file, hits });
  }
  return offenders;
}
