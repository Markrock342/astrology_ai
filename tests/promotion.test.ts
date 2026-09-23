import { describe, expect, it } from "vitest";
import {
  getLaunchPromotionCreditReferenceId,
  getLaunchPromotionUsageReferenceId,
  isLaunchProPromotionActive,
  LAUNCH_PRO_PROMOTION,
} from "@/config/promotion";

describe("seven-day Pro promotion (24 Sep – 1 Oct 2026)", () => {
  it("is active throughout the approved Bangkok date window", () => {
    expect(isLaunchProPromotionActive(new Date("2026-09-24T00:00:00+07:00"))).toBe(true);
    expect(isLaunchProPromotionActive(new Date("2026-09-28T12:00:00+07:00"))).toBe(true);
    expect(isLaunchProPromotionActive(new Date("2026-10-01T23:59:59+07:00"))).toBe(true);
  });

  it("expires on its own — nobody has to switch it off", () => {
    expect(isLaunchProPromotionActive(new Date("2026-10-02T00:00:00+07:00"))).toBe(false);
    // The month-long run it replaced is over, so its window must not reopen.
    expect(isLaunchProPromotionActive(new Date("2026-09-10T12:00:00+07:00"))).toBe(false);
  });

  it("resets the AI budget to the full Pro allowance", () => {
    expect(LAUNCH_PRO_PROMOTION.usageGrantPercent).toBe(100);
    expect(LAUNCH_PRO_PROMOTION.id).toBe("horasard-pro-week-2026-09");
  });

  it("keys credits and AI budget separately, once per account", () => {
    expect(getLaunchPromotionCreditReferenceId("user-123")).toBe(
      "horasard-pro-week-2026-09:user-123",
    );
    expect(getLaunchPromotionUsageReferenceId("user-123")).toBe(
      "usage:horasard-pro-week-2026-09:user-123",
    );
    // A new campaign id is what lets an account be granted again.
    expect(getLaunchPromotionUsageReferenceId("user-123")).not.toContain("month-2026-08");
  });
});
