import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import {
  deleteMyAccount,
  deleteUserAccountAsAdmin,
} from "@/server/user/account-deletion-service";

const mocks = vi.hoisted(() => ({
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
}));

describe("account-deletion-service (BE-E1.6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([{ proofUrl: "payment-slips/u/1.jpg" }]);
    mocks.deleteBlob.mockResolvedValue(undefined);
    mocks.deleteUser.mockResolvedValue(undefined);
    mocks.transaction.mockImplementation(async (fn) => fn({ user: { delete: mocks.deleteUser } }));
  });

  it("deleteMyAccount removes regular users", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "u-1",
      role: "USER",
      email: "u@test.com",
    });
    await deleteMyAccount("u-1");
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
