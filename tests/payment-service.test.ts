import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  reviewPayment,
  submitManualPayment,
} from "@/server/payment/payment-service";

const mocks = vi.hoisted(() => ({
  count: vi.fn(),
  create: vi.fn(),
  findUnique: vi.fn(),
  findPackage: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  subscriptionCreate: vi.fn(),
  transaction: vi.fn(),
  addCredits: vi.fn(),
  writeAudit: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    payment: {
      count: mocks.count,
      create: mocks.create,
      findUnique: mocks.findUnique,
      update: mocks.update,
    },
    package: { findUnique: mocks.findPackage },
    userSubscription: {
      updateMany: mocks.updateMany,
      create: mocks.subscriptionCreate,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/server/credit/credit-service", () => ({
  addCredits: mocks.addCredits,
}));

vi.mock("@/server/audit/audit-service", () => ({
  writeAudit: mocks.writeAudit,
}));

describe("payment-service (M4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.count.mockResolvedValue(0);
    mocks.create.mockResolvedValue({
      id: "pay-1",
      amount: 199,
      status: "PENDING",
      reference: null,
      createdAt: new Date(),
    });
  });

  it("submitManualPayment blocks duplicate pending request", async () => {
    mocks.count.mockResolvedValue(1);
    await expect(
      submitManualPayment("user-1", { amount: 199 }),
    ).rejects.toMatchObject({ code: "DUPLICATE_REQUEST" });
  });

  it("reviewPayment approve creates subscription and adds credits", async () => {
    const payment = {
      id: "pay-1",
      userId: "user-1",
      amount: 199,
      status: "PENDING",
      note: null,
      user: { id: "user-1", email: "u@test.com" },
    };
    const pkg = { id: "pkg-pro", code: "PRO", creditQuota: 100 };

    mocks.findUnique.mockResolvedValueOnce(payment);
    mocks.findPackage.mockResolvedValueOnce(pkg);

    const tx = {
      payment: {
        update: vi.fn().mockResolvedValue({
          id: "pay-1",
          status: "APPROVED",
          amount: 199,
          reviewedAt: new Date(),
          userId: "user-1",
        }),
      },
      userSubscription: {
        updateMany: mocks.updateMany,
        create: mocks.subscriptionCreate.mockResolvedValue({
          id: "sub-1",
          package: { code: "PRO", creditQuota: 100 },
        }),
      },
    };
    mocks.transaction.mockImplementation(async (fn) => fn(tx));

    const result = await reviewPayment(
      "pay-1",
      { status: "APPROVED", packageCode: "PRO" },
      { id: "admin-1" },
    );

    expect(result.payment.status).toBe("APPROVED");
    expect(mocks.addCredits).toHaveBeenCalledWith(
      "user-1",
      100,
      expect.objectContaining({ type: "PACKAGE_RENEWAL", referenceType: "payment" }),
      tx,
    );
    expect(mocks.writeAudit).toHaveBeenCalled();
  });

  it("reviewPayment reject does not add credits", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "pay-2",
      userId: "user-1",
      amount: 199,
      status: "PENDING",
      note: null,
      user: { id: "user-1", email: "u@test.com" },
    });

    const tx = {
      payment: {
        update: vi.fn().mockResolvedValue({
          id: "pay-2",
          status: "REJECTED",
          amount: 199,
          reviewedAt: new Date(),
          userId: "user-1",
        }),
      },
    };
    mocks.transaction.mockImplementation(async (fn) => fn(tx));

    await reviewPayment("pay-2", { status: "REJECTED" }, { id: "admin-1" });

    expect(mocks.addCredits).not.toHaveBeenCalled();
    expect(mocks.writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "payment.reject" }),
      tx,
    );
  });
});
