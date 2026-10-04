import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ logs: vi.fn(), updateMany: vi.fn() }));
vi.mock("@/server/db", () => ({
  prisma: { adminAuditLog: { findMany: mocks.logs }, package: { updateMany: mocks.updateMany } },
}));

import { restoreFlippedFromAudit } from "@/server/catalog/builtin-package-repair";

// 4 Oct 2026: markrock342, set Pro "ตลอดไป", still read Free. The code-based
// repair covered only PRO and CREDIT_TOPUP; any other package the form bug
// flipped stayed FREE.
describe("restoring packages the form bug flipped", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateMany.mockResolvedValue({ count: 1 });
  });

  it("puts back the type and top-up flag a package had before its first flip", async () => {
    mocks.logs.mockResolvedValue([
      { entityId: "p-pro-year", beforeJson: { type: "PRO", creditOnly: false }, afterJson: { type: "FREE", creditOnly: false } },
      { entityId: "p-topup", beforeJson: { type: "PRO", creditOnly: true }, afterJson: { type: "FREE", creditOnly: false } },
      { entityId: "p-pro-year", beforeJson: { type: "FREE" }, afterJson: { type: "FREE" } },
      { entityId: "p-price", beforeJson: { type: "PRO" }, afterJson: { type: "PRO" } },
    ]);
    expect(await restoreFlippedFromAudit()).toBe(2);
    expect(mocks.updateMany).toHaveBeenCalledWith({ where: { id: "p-pro-year", type: "FREE" }, data: { type: "PRO", creditOnly: false } });
    expect(mocks.updateMany).toHaveBeenCalledWith({ where: { id: "p-topup", type: "FREE" }, data: { type: "PRO", creditOnly: true } });
  });
});
