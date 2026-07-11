import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertWithinUsageLimits } from "@/server/credit/quota-service";

const mocks = vi.hoisted(() => ({
  findFirstSub: vi.fn(),
  findFirstPkg: vi.fn(),
  count: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    userSubscription: { findFirst: mocks.findFirstSub },
    package: { findFirst: mocks.findFirstPkg },
    aIUsageLog: { count: mocks.count },
  },
}));

describe("assertWithinUsageLimits (M3 B2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findFirstSub.mockResolvedValue({
      package: { dailyLimit: 3, monthlyLimit: null },
    });
  });

  it("passes when usage is below daily limit", async () => {
    mocks.count.mockResolvedValue(2);
    await expect(assertWithinUsageLimits("user-1")).resolves.toBeUndefined();
  });

  it("throws RATE_LIMITED when daily limit is reached", async () => {
    mocks.count.mockResolvedValue(3);
    await expect(assertWithinUsageLimits("user-1")).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
  });

  it("skips checks when package has no limits", async () => {
    mocks.findFirstSub.mockResolvedValue({
      package: { dailyLimit: null, monthlyLimit: null },
    });
    await assertWithinUsageLimits("user-1");
    expect(mocks.count).not.toHaveBeenCalled();
  });
});
