import { describe, expect, it } from "vitest";
import { isDestructive } from "../scripts/migration-guard";

/**
 * Migrations now auto-apply to production during the build, so this guard is the
 * only thing standing between a careless `DROP` and the live database. A guard
 * nobody tests is a guard nobody can trust.
 */
describe("migration guard — must BLOCK", () => {
  const dangerous: Array<[string, string]> = [
    ["DROP TABLE", 'DROP TABLE "messages";'],
    ["DROP COLUMN", 'ALTER TABLE "messages" DROP COLUMN "deletedAt";'],
    [
      // Postgres lets you omit the COLUMN keyword — matching /DROP\s+COLUMN/
      // alone was a hole you could drive a table through.
      "DROP column without the COLUMN keyword",
      'ALTER TABLE "messages" DROP "deletedAt";',
    ],
    ["TRUNCATE", 'TRUNCATE "messages";'],
    ["DELETE FROM", 'DELETE FROM "messages" WHERE "deletedAt" IS NOT NULL;'],
    ["mass UPDATE", 'UPDATE "messages" SET "content" = \'\';'],
    [
      "column type change",
      'ALTER TABLE "messages" ALTER COLUMN "creditCost" TYPE BIGINT;',
    ],
    [
      "SET NOT NULL on a populated table",
      'ALTER TABLE "messages" ALTER COLUMN "modelId" SET NOT NULL;',
    ],
    [
      // The OLD code is still serving traffic while the migration runs.
      "RENAME (breaks the running app mid-deploy)",
      'ALTER TABLE "messages" RENAME COLUMN "content" TO "body";',
    ],
    ["lowercase sql", "drop table messages;"],
    [
      "whitespace and newlines between keywords",
      'ALTER TABLE "messages"\n  DROP\n  COLUMN "deletedAt";',
    ],
  ];

  it.each(dangerous)("blocks %s", (_name, sql) => {
    expect(isDestructive(sql).length).toBeGreaterThan(0);
  });

  it("does not let a safe statement excuse a dangerous one in the same file", () => {
    const sql = [
      'ALTER TABLE "messages" ALTER COLUMN "modelId" DROP NOT NULL;',
      'ALTER TABLE "messages" DROP COLUMN "content";',
    ].join("\n");
    expect(isDestructive(sql)).not.toHaveLength(0);
  });
});

describe("migration guard — must ALLOW", () => {
  const safe: Array<[string, string]> = [
    [
      "add a nullable column",
      'ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);',
    ],
    ["create a table", 'CREATE TABLE "message_feedback" ("id" TEXT NOT NULL);'],
    ["create an index", 'CREATE INDEX "idx" ON "messages" ("createdAt");'],
    ["create an enum", `CREATE TYPE "FeedbackValue" AS ENUM ('UP', 'DOWN');`],
    [
      "add a foreign key",
      'ALTER TABLE "message_feedback" ADD CONSTRAINT "fk" FOREIGN KEY ("userId") REFERENCES "users"("id");',
    ],
    [
      // Relaxing a constraint is not destruction.
      "DROP NOT NULL",
      'ALTER TABLE "messages" ALTER COLUMN "modelId" DROP NOT NULL;',
    ],
    [
      "DROP DEFAULT",
      'ALTER TABLE "messages" ALTER COLUMN "creditCost" DROP DEFAULT;',
    ],
  ];

  it.each(safe)("allows %s", (_name, sql) => {
    expect(isDestructive(sql)).toEqual([]);
  });

  it("ignores dangerous words that appear only in comments", () => {
    const sql = [
      "-- This does NOT drop table messages, it only adds a column.",
      "/* We considered DELETE FROM messages but chose not to. */",
      'ALTER TABLE "messages" ADD COLUMN "note" TEXT;',
    ].join("\n");
    expect(isDestructive(sql)).toEqual([]);
  });

  it("ignores CRLF comment prose that mentions drop/recreate", () => {
    const sql = [
      "-- also wanted to drop and recreate three unrelated indexes",
      "-- Dropping a live index just to re-add it is downtime",
      'ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);',
    ].join("\r\n");
    expect(isDestructive(sql)).toEqual([]);
  });
});
