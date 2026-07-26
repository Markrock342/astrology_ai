import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  update: vi.fn(),
  count: vi.fn(),
  delBlob: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    payment: {
      findMany: mocks.findMany,
      update: mocks.update,
      count: mocks.count,
    },
  },
}));

vi.mock("@/server/payment/payment-proof", () => ({
  deletePaymentProofBlob: mocks.delBlob,
}));

import {
  countOverduePendingPayments,
  runSlipRetentionSweep,
} from "@/server/payment/slip-retention-service";
import { SLIP_RETENTION_DAYS } from "@/config/constants";

describe("slip retention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.delBlob.mockResolvedValue(undefined);
    mocks.update.mockResolvedValue({});
  });

  it("deletes reviewed slip blobs past retention window", async () => {
    mocks.findMany.mockResolvedValue([
      { id: "p1", proofUrl: "payment-slips/u1/1.jpg" },
    ]);
    const now = new Date("2026-07-26T00:00:00Z");
    const result = await runSlipRetentionSweep(now);
    expect(result).toEqual({ scanned: 1, deleted: 1 });
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
