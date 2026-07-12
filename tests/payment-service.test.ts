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
      user: { id: "user-1", email: "u@test.com" },
    };
    const pkg = { id: "pkg-pro", code: "PRO", creditQuota: 100, creditOnly: false };
    const updated = {
      id: "pay-1",
      status: "APPROVED",
      amount: 199,
      reviewedAt: new Date(),
      userId: "user-1",
    };

    mocks.findUnique.mockResolvedValueOnce(payment);
    mocks.findPackage.mockResolvedValueOnce(pkg);

    const tx = {
      payment: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(updated),
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
    expect(tx.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pay-1", status: "PENDING" },
      }),
    );
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
      user: { id: "user-1", email: "u@test.com" },
    });
    mocks.findPackage.mockResolvedValue({
      id: "pkg-pro",
      code: "PRO",
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
        { status: "APPROVED", packageCode: "PRO" },
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
      { status: "APPROVED", packageCode: "CREDIT_TOPUP" },
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
