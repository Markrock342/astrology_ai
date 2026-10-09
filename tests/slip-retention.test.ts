import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  update: vi.fn(),
  count: vi.fn(),
  delBlob: vi.fn(),
  userFindMany: vi.fn(),
  listSlips: vi.fn(),
  deleteSlips: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    payment: {
      findMany: mocks.findMany,
      update: mocks.update,
      count: mocks.count,
    },
    user: { findMany: mocks.userFindMany },
  },
}));

vi.mock("@/server/payment/payment-proof", () => ({
  deletePaymentProofBlob: mocks.delBlob,
  listStoredSlips: mocks.listSlips,
  deleteStoredSlips: mocks.deleteSlips,
}));

import {
  countOverduePendingPayments,
  findOrphanSlips,
  runSlipRetentionSweep,
} from "@/server/payment/slip-retention-service";
import { SLIP_RETENTION_DAYS } from "@/config/constants";

describe("slip retention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.delBlob.mockResolvedValue(true);
    mocks.update.mockResolvedValue({});
    mocks.listSlips.mockResolvedValue(null);
  });

  // QA 2026-10-04: a failed delete still cleared the link — an orphaned slip.
  it("keeps the link when the slip could not be deleted, for the next sweep", async () => {
    mocks.findMany.mockResolvedValue([{ id: "p1", proofUrl: "payment-slips/u1/1.jpg" }]);
    mocks.delBlob.mockResolvedValue(false);
    const result = await runSlipRetentionSweep(new Date("2026-07-26T00:00:00Z"));
    expect(result).toEqual({ scanned: 1, deleted: 0, orphans: null });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("deletes reviewed slip blobs past retention window", async () => {
    mocks.findMany.mockResolvedValue([
      { id: "p1", proofUrl: "payment-slips/u1/1.jpg" },
    ]);
    const now = new Date("2026-07-26T00:00:00Z");
    const result = await runSlipRetentionSweep(now);
    expect(result).toEqual({ scanned: 1, deleted: 1, orphans: null });
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["APPROVED", "REJECTED"] },
          reviewedAt: {
            lt: new Date(
              now.getTime() - SLIP_RETENTION_DAYS * 24 * 60 * 60 * 1000,
            ),
          },
        }),
      }),
    );
    expect(mocks.delBlob).toHaveBeenCalledWith("payment-slips/u1/1.jpg");
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { proofUrl: null },
    });
  });

  it("counts overdue pending payments", async () => {
    mocks.count.mockResolvedValue(3);
    await expect(countOverduePendingPayments(48)).resolves.toBe(3);
  });
});

// Code review 2026-10-09: a slip uploaded and never sent, or left by a deleted
// account, had nothing pointing at it and was never deleted (PDPA).
describe("orphan slips", () => {
  const now = new Date("2026-10-09T12:00:00Z");
  const old = new Date(now.getTime() - 2 * 24 * 3_600_000);
  const fresh = new Date(now.getTime() - 3_600_000);
  const slip = (pathname: string, uploadedAt: Date) => ({ url: `https://blob/${pathname}`, pathname, uploadedAt });

  it("removes slips of deleted accounts and old unsent ones, keeps the rest", async () => {
    mocks.userFindMany.mockResolvedValue([{ id: "alive" }]);
    mocks.findMany.mockResolvedValue([{ proofUrl: "payment-slips/alive/sent.jpg" }]);
    const out = await findOrphanSlips(
      [
        slip("payment-slips/gone/a.jpg", fresh),
        slip("payment-slips/alive/sent.jpg", old),
        slip("payment-slips/alive/unsent-old.jpg", old),
        slip("payment-slips/alive/unsent-new.jpg", fresh),
      ],
      now,
    );
    expect(out.map((s) => s.pathname).sort()).toEqual([
      "payment-slips/alive/unsent-old.jpg",
      "payment-slips/gone/a.jpg",
    ]);
  });
});
