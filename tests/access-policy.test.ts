import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertCanRequestReading } from "@/server/horoscope/access-policy";

const mocks = vi.hoisted(() => ({
  getEffectivePlan: vi.fn(),
  findUser: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: { user: { findUnique: mocks.findUser } },
}));
vi.mock("@/server/user/account-service", () => ({
  getEffectivePlan: mocks.getEffectivePlan,
}));

/** A verified, password-based Free account asking its first natal question. */
const FREE_HAPPY = {
  userId: "u1",
  categoryAccessLevel: "FREE" as const,
  mode: "NATAL" as const,
  isFollowUp: false,
};

describe("free tier access policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getEffectivePlan.mockResolvedValue("FREE");
    mocks.findUser.mockResolvedValue({
      emailVerifiedAt: new Date(),
      passwordHash: "hash",
    });
  });

  it("lets a Free user actually spend the credits it was granted", async () => {
    // The whole point: this used to throw CHAT_REQUIRES_PRO, which made the
    // 3 sign-up credits unspendable and the advertised trial fictional.
    await expect(assertCanRequestReading(FREE_HAPPY)).resolves.toBe("FREE");
  });

  it("keeps Pro categories locked for Free", async () => {
    await expect(
      assertCanRequestReading({ ...FREE_HAPPY, categoryAccessLevel: "PRO" }),
    ).rejects.toMatchObject({ code: "CATEGORY_LOCKED" });
  });

  it("keeps transit a Pro feature", async () => {
    await expect(
      assertCanRequestReading({ ...FREE_HAPPY, mode: "TRANSIT" }),
    ).rejects.toMatchObject({ code: "TRANSIT_REQUIRES_PRO" });
  });

  it("allows Free follow-ups — each turn still spends a credit like ChatGPT", async () => {
    await expect(
      assertCanRequestReading({ ...FREE_HAPPY, isFollowUp: true }),
    ).resolves.toBe("FREE");
  });

  it("refuses an unverified email — otherwise the trial is farmable with throwaway addresses", async () => {
    mocks.findUser.mockResolvedValue({
      emailVerifiedAt: null,
      passwordHash: "hash",
    });

    await expect(assertCanRequestReading(FREE_HAPPY)).rejects.toMatchObject({
      code: "EMAIL_NOT_VERIFIED",
    });
  });

  it("does not ask an OAuth account to verify — the provider already did", async () => {
    mocks.findUser.mockResolvedValue({
      emailVerifiedAt: null,
      passwordHash: null,
    });

    await expect(assertCanRequestReading(FREE_HAPPY)).resolves.toBe("FREE");
  });

  it("waves Pro through every gate", async () => {
    mocks.getEffectivePlan.mockResolvedValue("PRO");

    await expect(
      assertCanRequestReading({
        userId: "u1",
        categoryAccessLevel: "PRO",
        mode: "TRANSIT",
        isFollowUp: true,
      }),
    ).resolves.toBe("PRO");
    // Pro must never be asked to verify an email to use what it paid for.
    expect(mocks.findUser).not.toHaveBeenCalled();
  });
});
