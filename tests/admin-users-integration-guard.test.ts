import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("admin users integration database guard", () => {
  it.each([
    "postgresql://test:placeholder@example.invalid/hora_admin_filter_test",
    "postgresql://test:placeholder@localhost/production",
    "postgresql://test:placeholder@127.0.0.1/hora_admin_filter_test?host=example.invalid",
  ])("rejects unsafe test targets before starting Prisma: %s", (databaseUrl) => {
    const result = spawnSync(process.execPath, ["scripts/test-admin-users-integration.mjs"], {
      env: { ...process.env, DATABASE_URL: databaseUrl }, encoding: "utf8",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Refusing integration migrations");
    expect(result.stdout).not.toContain("Prisma schema loaded");
  });
});
