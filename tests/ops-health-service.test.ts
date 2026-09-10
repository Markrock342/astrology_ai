import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/db", () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

import { prisma } from "@/server/db";
import { getDatabaseHealth } from "@/server/admin/ops-health-service";

describe("getDatabaseHealth", () => {
  beforeEach(() => {
    vi.mocked(prisma.$queryRaw).mockReset();
  });

  it("reports a successful live database query", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ "?column?": 1 }] as never);

    const health = await getDatabaseHealth();

    expect(health.connected).toBe(true);
    expect(health.latencyMs).toEqual(expect.any(Number));
    expect(Number.isNaN(Date.parse(health.checkedAt))).toBe(false);
  });

  it("reports an unreachable database without exposing the error", async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValue(
      new Error("password secret at private-db:5432"),
    );

    const health = await getDatabaseHealth();

    expect(health).toMatchObject({
      connected: false,
      latencyMs: null,
    });
    expect(health).not.toHaveProperty("error");
  });
});
