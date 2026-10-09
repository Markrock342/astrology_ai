import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import {
  deleteMyAccount,
  deleteUserAccountAsAdmin,
} from "@/server/user/account-deletion-service";

const mocks = vi.hoisted(() => ({
  deleteFolder: vi.fn(async () => true),
  findUnique: vi.fn(),
  count: vi.fn(),
  findMany: vi.fn(),
  deleteUser: vi.fn(),
  transaction: vi.fn(),
  writeAudit: vi.fn(),
  deleteBlob: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    user: {
      findUnique: mocks.findUnique,
      count: mocks.count,
      delete: mocks.deleteUser,
    },
    payment: { findMany: mocks.findMany },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/server/audit/audit-service", () => ({
  writeAudit: mocks.writeAudit,
}));

vi.mock("@/server/payment/payment-proof", () => ({
  deletePaymentProofBlob: mocks.deleteBlob,
  deleteUserSlipFolder: mocks.deleteFolder,
}));

const order: string[] = [];
const many = (name: string) => ({
  updateMany: vi.fn(async () => { order.push(`${name}.updateMany`); return { count: 0 }; }),
  deleteMany: vi.fn(async () => { order.push(`${name}.deleteMany`); return { count: 0 }; }),
});
function txMock() {
  return {
    user: { delete: async (a: unknown) => { order.push("user.delete"); return mocks.deleteUser(a); } },
    creditTransaction: many("creditTransaction"),
    usageTransaction: many("usageTransaction"),
    payment: many("payment"),
    promptTemplate: many("promptTemplate"),
    knowledgeDoc: many("knowledgeDoc"),
    appSetting: many("appSetting"),
    faqItem: many("faqItem"),
    adminAuditLog: many("adminAuditLog"),
    contentRevision: many("contentRevision"),
  };
}

describe("account-deletion-service (BE-E1.6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([{ proofUrl: "payment-slips/u/1.jpg" }]);
    mocks.deleteBlob.mockResolvedValue(undefined);
    mocks.deleteUser.mockResolvedValue(undefined);
    mocks.transaction.mockImplementation(async (fn) => fn(txMock()));
  });

  it("deleteMyAccount removes regular users", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "u-1",
      role: "USER",
      email: "u@test.com",
    });
    await deleteMyAccount("u-1", { email: "u@test.com" });
    expect(mocks.deleteBlob).toHaveBeenCalled();
    expect(mocks.deleteUser).toHaveBeenCalledWith({ where: { id: "u-1" } });
  });

  it("deleteMyAccount blocks admin roles", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "a-1",
      role: "ADMIN",
      email: "a@test.com",
    });
    await expect(deleteMyAccount("a-1")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("deleteUserAccountAsAdmin audits and deletes", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "u-2",
      email: "u2@test.com",
      role: "USER",
      name: "U2",
    });
    await deleteUserAccountAsAdmin("u-2", { id: "sa-1" });
    expect(mocks.writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "user.delete", entityId: "u-2" }),
      expect.anything(),
    );
    expect(mocks.deleteUser).toHaveBeenCalled();
  });

  it("deleteUserAccountAsAdmin blocks deleting last super admin", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "sa-2",
      email: "sa@test.com",
      role: "SUPER_ADMIN",
      name: "SA",
    });
    mocks.count.mockResolvedValue(1);
    await expect(
      deleteUserAccountAsAdmin("sa-2", { id: "sa-3" }),
    ).rejects.toBeInstanceOf(AppError);
  });
});

describe("deletion with rows that do not cascade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    order.length = 0;
    mocks.findMany.mockResolvedValue([{ proofUrl: "payment-slips/u/1.jpg" }]);
    mocks.deleteBlob.mockImplementation(async () => { order.push("blob.delete"); });
    mocks.deleteUser.mockResolvedValue(undefined);
    mocks.transaction.mockImplementation(async (fn) => fn(txMock()));
  });

  it("removes the user's own audit rows first and deletes slips only after the rows", async () => {
    mocks.findUnique.mockResolvedValue({ id: "u-1", role: "USER", email: "u@test.com" });
    await deleteMyAccount("u-1", { email: "u@test.com" });
    expect(order).toContain("adminAuditLog.deleteMany");
    expect(order.indexOf("adminAuditLog.deleteMany")).toBeLessThan(order.indexOf("user.delete"));
    expect(order.indexOf("user.delete")).toBeLessThan(order.indexOf("blob.delete"));
  });

  it("keeps a slip when the deletion fails", async () => {
    mocks.findUnique.mockResolvedValue({ id: "u-1", role: "USER", email: "u@test.com" });
    mocks.deleteUser.mockRejectedValue(new Error("fk"));
    await expect(deleteMyAccount("u-1", { email: "u@test.com" })).rejects.toThrow();
    expect(mocks.deleteBlob).not.toHaveBeenCalled();
  });
});

// Code review 2026-10-09: a session alone could delete the account.
describe("self-deletion asks the owner", () => {
  it("refuses a wrong password, and a Google account without its email typed", async () => {
    const bcrypt = await import("bcryptjs");
    mocks.findUnique.mockResolvedValue({
      id: "p-1",
      role: "USER",
      email: "p@test.com",
      passwordHash: await bcrypt.hash("right-password", 4),
    });
    await expect(deleteMyAccount("p-1", { password: "wrong" })).rejects.toThrow("รหัสผ่านไม่ถูกต้อง");
    mocks.findUnique.mockResolvedValue({ id: "g-1", role: "USER", email: "g@test.com", passwordHash: null });
    await expect(deleteMyAccount("g-1", {})).rejects.toThrow("พิมพ์อีเมล");
  });
});
