import { describe, expect, it } from "vitest";
import { resolveProExpiry, subscriptionExpiryPayload } from "@/lib/pro-expiry";

const promotionEndsAt = new Date("2026-09-23T23:59:59+07:00");
const base = { promotionActive: true, promotionEndsAt };

describe("resolveProExpiry", () => {
  it("keeps an admin-set date that falls inside the promotion window", () => {
    // Regression: the promotion used to overwrite any earlier expiry, so an
    // admin could set 20 ก.ย. and the account still showed 23 ก.ย.
    const expiresAt = new Date("2026-09-20T23:59:59+07:00");
    const out = resolveProExpiry({ ...base, subscription: { expiresAt } });
    expect(out.endsAt).toEqual(expiresAt);
    expect(out.neverExpires).toBe(false);
  });

  it("treats a subscription with no expiry as Pro forever", () => {
    const out = resolveProExpiry({ ...base, subscription: { expiresAt: null } });
    expect(out.endsAt).toBeNull();
    expect(out.neverExpires).toBe(true);
    expect(out.showPromotion).toBe(false);
  });

  it("keeps an admin-set date that outlasts the promotion, and hides the promo banner", () => {
    const expiresAt = new Date("2026-12-31T23:59:59+07:00");
    const out = resolveProExpiry({ ...base, subscription: { expiresAt } });
    expect(out.endsAt).toEqual(expiresAt);
    expect(out.showPromotion).toBe(false);
  });

  it("still announces the promotion to accounts it actually grants", () => {
    const out = resolveProExpiry({
      ...base,
      subscription: { expiresAt: promotionEndsAt },
    });
    expect(out.endsAt).toEqual(promotionEndsAt);
    expect(out.showPromotion).toBe(true);
  });

  it("falls back to the promotion end for an account with no subscription", () => {
    const out = resolveProExpiry({ ...base, subscription: null });
    expect(out.endsAt).toEqual(promotionEndsAt);
    expect(out.neverExpires).toBe(false);
    expect(out.showPromotion).toBe(true);
  });

  it("reports no Pro once the promotion is over and nothing was granted", () => {
    const out = resolveProExpiry({
      ...base,
      promotionActive: false,
      subscription: null,
    });
    expect(out.endsAt).toBeNull();
    expect(out.showPromotion).toBe(false);
  });
});

describe("subscriptionExpiryPayload (admin form)", () => {
  it("sends null for ใช้ได้ตลอดไป", () => {
    expect(subscriptionExpiryPayload("forever", "2026-12-31")).toBeNull();
  });

  it("keeps Pro working through the whole chosen Bangkok day", () => {
    expect(subscriptionExpiryPayload("date", "2026-12-31")).toBe(
      "2026-12-31T16:59:59.000Z",
    );
  });
});
