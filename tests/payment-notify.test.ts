import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  notifyUserPaymentReviewed,
  persistPaymentNotifyResult,
} from "@/server/payment/payment-notify";

const mocks = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/server/email/mailer", () => ({
  sendEmail: mocks.sendEmail,
}));

vi.mock("@/server/push/web-push-service", () => ({
  sendWebPushToAdmins: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    payment: { update: mocks.update },
  },
}));

describe("payment-notify (BE-E0.3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persistPaymentNotifyResult stores success timestamp", async () => {
    await persistPaymentNotifyResult("pay-1", { ok: true, via: "resend" });
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "pay-1" },
      data: { notifiedAt: expect.any(Date), notifyError: null },
    });
  });

  it("persistPaymentNotifyResult stores error message", async () => {
    await persistPaymentNotifyResult("pay-1", { ok: false, error: "smtp down" });
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "pay-1" },
      data: { notifyError: "smtp down" },
    });
  });

  it("notifyUserPaymentReviewed returns sendEmail result", async () => {
    mocks.sendEmail.mockResolvedValue({ ok: true, via: "dev" });
    const result = await notifyUserPaymentReviewed({
      userEmail: "u@test.com",
      approved: true,
      amount: 199,
    });
    expect(result).toEqual({ ok: true, via: "dev" });
  });
});
