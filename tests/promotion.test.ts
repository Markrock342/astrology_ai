import { describe, expect, it } from "vitest";
import {
  getLaunchPromotionCreditReferenceId,
  isLaunchProPromotionActive,
  LAUNCH_PRO_PROMOTION,
} from "@/config/promotion";

describe("one-month Pro launch promotion", () => {
  it("is active throughout the approved Bangkok date window", () => {
    expect(isLaunchProPromotionActive(new Date("2026-08-23T00:00:00+07:00"))).toBe(true);
    expect(isLaunchProPromotionActive(new Date("2026-09-23T23:59:59+07:00"))).toBe(true);
  });

  it("expires automatically and grants 50 credits once per account", () => {
    expect(isLaunchProPromotionActive(new Date("2026-09-24T00:00:00+07:00"))).toBe(false);
    expect(LAUNCH_PRO_PROMOTION.creditGrant).toBe(50);
    expect(LAUNCH_PRO_PROMOTION.id).toBe("horasard-pro-month-2026-08");
  });

  it("uses a per-user ledger reference so each account is granted once", () => {
    expect(getLaunchPromotionCreditReferenceId("user-123")).toBe(
      "horasard-pro-month-2026-08:user-123",
    );
  });
});
