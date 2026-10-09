import { beforeEach, describe, expect, it, vi } from "vitest";

// Code review 2026-10-09: two requests with one link both set a password, and
// a link sent before an account was disabled still worked.
const mocks = vi.hoisted(() => ({
  findToken: vi.fn(),
  claim: vi.fn(),
  userUpdate: vi.fn(),
  deleteTokens: vi.fn(),
}));

vi.mock("@/server/db", () => {
  const tx = {
    passwordResetToken: { updateMany: mocks.claim, deleteMany: mocks.deleteTokens },
    user: { update: mocks.userUpdate },
  };
  return {
    prisma: {
      passwordResetToken: { findUnique: mocks.findToken },
      $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
    },
  };
});
vi.mock("@/server/email/mailer", () => ({ sendEmail: vi.fn() }));
vi.mock("@/config/env", () => ({ env: {} }));
vi.mock("@/server/auth/account-lookup", () => ({ normalizeEmail: (e: string) => e }));

import { resetPassword } from "@/server/auth/password-reset-service";

const record = (status = "ACTIVE") => ({
  id: "t1",
  userId: "u1",
  usedAt: null,
  expiresAt: new Date(Date.now() + 60_000),
  user: { status },
});

describe("password reset", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sets the password once and kills other links", async () => {
    mocks.findToken.mockResolvedValue(record());
    mocks.claim.mockResolvedValue({ count: 1 });
    await resetPassword("raw", "new-password-1");
    expect(mocks.userUpdate).toHaveBeenCalledTimes(1);
    expect(mocks.deleteTokens).toHaveBeenCalledWith({ where: { userId: "u1", usedAt: null } });
  });

  it("refuses the second of two requests racing with one link", async () => {
    mocks.findToken.mockResolvedValue(record());
    mocks.claim.mockResolvedValue({ count: 0 });
    await expect(resetPassword("raw", "new-password-1")).rejects.toThrow();
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it("refuses a disabled account", async () => {
    mocks.findToken.mockResolvedValue(record("DISABLED"));
    await expect(resetPassword("raw", "new-password-1")).rejects.toThrow();
    expect(mocks.claim).not.toHaveBeenCalled();
  });
});
