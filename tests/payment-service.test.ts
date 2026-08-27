import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  reviewPayment,
  submitManualPayment,
} from "@/server/payment/payment-service";
import { AppError } from "@/lib/errors";

const mocks = vi.hoisted(() => ({
  count: vi.fn(),
  create: vi.fn(),
  findUnique: vi.fn(),
  findPackage: vi.fn(),
  findFirstPackage: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  subscriptionCreate: vi.fn(),
  transaction: vi.fn(),
  addCredits: vi.fn(),
  grantIncludedUsage: vi.fn(),
  addPurchasedUsage: vi.fn(),
  writeAudit: vi.fn(),
  userFindUnique: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    payment: {
      count: mocks.count,
      create: mocks.create,
      findUnique: mocks.findUnique,
      update: mocks.update,
    },
    package: { findUnique: mocks.findPackage, findFirst: mocks.findFirstPackage },
    user: { findUnique: mocks.userFindUnique },
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

vi.mock("@/server/usage/usage-budget-service", () => ({
  grantIncludedUsage: mocks.grantIncludedUsage,
  addPurchasedUsage: mocks.addPurchasedUsage,
}));

vi.mock("@/server/audit/audit-service", () => ({
  writeAudit: mocks.writeAudit,
}));

vi.mock("@/server/payment/payment-proof", async () => {
  const { AppError } = await import("@/lib/errors");
  return {
    assertOwnedProofPath: (userId: string, path: string) => {
      const prefix = `payment-slips/${userId}/`;
      if (!path.startsWith(prefix)) {
        throw new AppError("VALIDATION", "พาธสลิปไม่ถูกต้อง");
      }
      return path;
    },
    deletePaymentProofBlob: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("@/server/payment/payment-notify", () => ({
  notifyAdminsNewPayment: vi.fn().mockResolvedValue(undefined),
  notifyUserPaymentReviewed: vi.fn().mockResolvedValue({ ok: true, via: "dev" }),
  persistPaymentNotifyResult: vi.fn().mockResolvedValue(undefined),
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
      proofUrl: "https://blob.example/slip.jpg",
      createdAt: new Date(),
    });
    mocks.userFindUnique.mockResolvedValue({
      email: "u@test.com",
      name: "User",
    });
  });

  it("submitManualPayment blocks duplicate pending request", async () => {
    mocks.count.mockResolvedValue(1);
    await expect(
      submitManualPayment("user-1", {
        amount: 199,
        proofPath: "payment-slips/user-1/1.jpg",
      }),
    ).rejects.toMatchObject({ code: "DUPLICATE_REQUEST" });
  });

  it("submitManualPayment requires proofPath", async () => {
    await expect(
      submitManualPayment("user-1", { amount: 199, proofPath: "" }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("submitManualPayment rejects proofPath for another user", async () => {
    await expect(
      submitManualPayment("user-1", {
        amount: 199,
        proofPath: "payment-slips/other-user/1.jpg",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("submitManualPayment rejects amount mismatch when packageCode is set", async () => {
    mocks.findFirstPackage.mockResolvedValue({ id: "pkg-pro", price: 199 });
    await expect(
      submitManualPayment("user-1", {
        amount: 150,
        proofPath: "payment-slips/user-1/1.jpg",
        packageCode: "PRO",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("reviewPayment approve creates subscription and adds credits", async () => {
    const payment = {
      id: "pay-1",
      userId: "user-1",
      amount: 199,
      status: "PENDING",
      note: null,
      packageCode: "PRO",
      user: { id: "user-1", email: "u@test.com" },
    };
    const pkg = {
      id: "pkg-pro",
      code: "PRO",
      price: 199,
      creditQuota: 100,
      usageBudgetUnits: 1_111_111,
      creditOnly: false,
    };
    const updated = {
      id: "pay-1",
      status: "APPROVED",
      amount: 199,
      reviewedAt: new Date(),
      userId: "user-1",
      packageCode: "PRO",
    };

    mocks.findUnique.mockResolvedValueOnce(payment);
    mocks.findPackage.mockResolvedValueOnce(pkg);

    const tx = {
      payment: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(updated),
      },
      userSubscription: {
        findMany: vi.fn().mockResolvedValue([]),
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
      { status: "APPROVED" },
      { id: "admin-1" },
    );

    expect(result.payment.status).toBe("APPROVED");
    expect(tx.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pay-1", status: "PENDING" },
      }),
    );
    expect(mocks.subscriptionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          expiresAt: expect.any(Date),
        }),
      }),
    );
    expect(mocks.addCredits).toHaveBeenCalledWith(
      "user-1",
      100,
      expect.objectContaining({ type: "PACKAGE_RENEWAL", referenceType: "payment" }),
      tx,
    );
    expect(mocks.grantIncludedUsage).toHaveBeenCalledWith(
      "user-1",
      1_111_111,
      expect.objectContaining({ type: "PACKAGE_RENEWAL" }),
      expect.objectContaining({ startsAt: expect.any(Date), endsAt: expect.any(Date) }),
      tx,
    );
    expect(mocks.writeAudit).toHaveBeenCalled();
  });

  it("reviewPayment EXTENDS an active subscription instead of resetting it", async () => {
    const payment = {
      id: "pay-2",
      userId: "user-1",
      amount: 199,
      status: "PENDING",
      note: null,
      packageCode: "PRO",
      user: { id: "user-1", email: "u@test.com" },
    };
    mocks.findUnique.mockResolvedValueOnce(payment);
    mocks.findPackage.mockResolvedValueOnce({
      id: "pkg-pro",
      code: "PRO",
      price: 199,
      creditQuota: 100,
      creditOnly: false,
    });

    // 20 days of Pro still remaining → new expiry must be ~50 days out (20 + 30),
    // NOT 30. Regression guard for the renewal-reset bug.
    const remaining = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
    const create = vi.fn().mockResolvedValue({
      id: "sub-2",
      package: { code: "PRO", creditQuota: 100 },
    });
    const tx = {
      payment: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: "pay-2",
          status: "APPROVED",
          amount: 199,
          reviewedAt: new Date(),
          userId: "user-1",
          packageCode: "PRO",
        }),
      },
      userSubscription: {
        findMany: vi.fn().mockResolvedValue([{ expiresAt: remaining }]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        create,
      },
    };
    mocks.transaction.mockImplementation(async (fn) => fn(tx));

    await reviewPayment("pay-2", { status: "APPROVED" }, { id: "admin-1" });

    const newExpiry: Date = create.mock.calls[0][0].data.expiresAt;
    const daysOut = (newExpiry.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(daysOut).toBeGreaterThan(49);
    expect(daysOut).toBeLessThan(51);
  });

  it("reviewPayment prefers payment.packageCode over admin override PRO", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "pay-topup-hijack",
      userId: "user-1",
      amount: 99,
      status: "PENDING",
      note: null,
      packageCode: "CREDIT_TOPUP",
      user: { id: "user-1", email: "u@test.com" },
    });
    mocks.findPackage.mockResolvedValue({
      id: "pkg-topup",
      code: "CREDIT_TOPUP",
      price: 99,
      creditQuota: 50,
      usageBudgetUnits: 555_556,
      creditOnly: true,
    });

    const updated = {
      id: "pay-topup-hijack",
      status: "APPROVED",
      amount: 99,
      reviewedAt: new Date(),
      userId: "user-1",
      packageCode: "CREDIT_TOPUP",
    };
    const tx = {
      payment: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(updated),
      },
      userSubscription: {
        updateMany: mocks.updateMany,
        create: mocks.subscriptionCreate,
      },
    };
    mocks.transaction.mockImplementation(async (fn) => fn(tx));

    // Simulate old buggy admin UI sending PRO on every approve.
    await reviewPayment(
      "pay-topup-hijack",
      { status: "APPROVED", packageCode: "PRO" },
      { id: "admin-1" },
    );

    expect(mocks.findPackage).toHaveBeenCalledWith({
      where: { code: "CREDIT_TOPUP" },
      select: expect.any(Object),
    });
    expect(mocks.addCredits).toHaveBeenCalledWith(
      "user-1",
      50,
      expect.objectContaining({ type: "PROMOTION" }),
      tx,
    );
    expect(mocks.addPurchasedUsage).toHaveBeenCalledWith(
      "user-1",
      555_556,
      expect.objectContaining({ type: "TOP_UP" }),
      tx,
    );
    expect(mocks.subscriptionCreate).not.toHaveBeenCalled();
  });

  it("reviewPayment rejects amount ≠ package price", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "pay-mismatch",
      userId: "user-1",
      amount: 50,
      status: "PENDING",
      note: null,
      packageCode: "PRO",
      user: { id: "user-1", email: "u@test.com" },
    });
    mocks.findPackage.mockResolvedValue({
      id: "pkg-pro",
      code: "PRO",
      price: 199,
      creditQuota: 100,
      creditOnly: false,
    });

    await expect(
      reviewPayment("pay-mismatch", { status: "APPROVED" }, { id: "admin-1" }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("reviewPayment blocks self-approve", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "pay-self",
      userId: "admin-1",
      amount: 199,
      status: "PENDING",
      note: null,
      packageCode: "PRO",
      user: { id: "admin-1", email: "admin@test.com" },
    });

    await expect(
      reviewPayment("pay-self", { status: "APPROVED" }, { id: "admin-1" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
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

    const updated = {
      id: "pay-2",
      status: "REJECTED",
      amount: 199,
      reviewedAt: new Date(),
      userId: "user-1",
    };
    const tx = {
      payment: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(updated),
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

  it("reviewPayment second concurrent approve loses CAS and does not grant", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "pay-3",
      userId: "user-1",
      amount: 199,
      status: "PENDING",
      note: null,
      packageCode: "PRO",
      user: { id: "user-1", email: "u@test.com" },
    });
    mocks.findPackage.mockResolvedValue({
      id: "pkg-pro",
      code: "PRO",
      price: 199,
      creditQuota: 100,
      creditOnly: false,
    });

    const tx = {
      payment: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: vi.fn(),
      },
      userSubscription: {
        updateMany: mocks.updateMany,
        create: mocks.subscriptionCreate,
      },
    };
    mocks.transaction.mockImplementation(async (fn) => fn(tx));

    await expect(
      reviewPayment(
        "pay-3",
        { status: "APPROVED" },
        { id: "admin-2" },
      ),
    ).rejects.toBeInstanceOf(AppError);

    expect(mocks.addCredits).not.toHaveBeenCalled();
    expect(mocks.subscriptionCreate).not.toHaveBeenCalled();
    expect(tx.payment.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it("reviewPayment approve credit-only top-up adds credits without subscription", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "pay-topup",
      userId: "user-1",
      amount: 99,
      status: "PENDING",
      note: null,
      packageCode: "CREDIT_TOPUP",
      user: { id: "user-1", email: "u@test.com" },
    });
    mocks.findPackage.mockResolvedValue({
      id: "pkg-topup",
      code: "CREDIT_TOPUP",
      price: 99,
      creditQuota: 50,
      creditOnly: true,
    });

    const updated = {
      id: "pay-topup",
      status: "APPROVED",
      amount: 99,
      reviewedAt: new Date(),
      userId: "user-1",
      packageCode: "CREDIT_TOPUP",
    };
    const tx = {
      payment: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(updated),
      },
      userSubscription: {
        updateMany: mocks.updateMany,
        create: mocks.subscriptionCreate,
      },
    };
    mocks.transaction.mockImplementation(async (fn) => fn(tx));

    await reviewPayment(
      "pay-topup",
      { status: "APPROVED" },
      { id: "admin-1" },
    );

    expect(mocks.addCredits).toHaveBeenCalledWith(
      "user-1",
      50,
      expect.objectContaining({ type: "PROMOTION" }),
      tx,
    );
    expect(mocks.subscriptionCreate).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
});
