import { describe, expect, it } from "vitest";
import { appPlanLabel } from "@/lib/app-plan-label";

describe("appPlanLabel", () => {
  it("hides internal access tiers for ordinary users", () => {
    expect(
      appPlanLabel({ role: "USER", plan: "PRO", packageName: "Plus" }),
    ).toBe("");
  });

  it("keeps staff roles and safe fallbacks", () => {
    expect(appPlanLabel({ role: "SUPER_ADMIN", plan: "PRO", packageName: "Plus" })).toBe(
      "Super Admin",
    );
    expect(appPlanLabel({ role: "USER", plan: "PRO", packageName: null })).toBe("");
    expect(appPlanLabel({ role: "USER", plan: "FREE", packageName: null })).toBe("");
  });
});
