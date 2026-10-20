import { describe, expect, it } from "vitest";
import { appPlanLabel } from "@/lib/app-plan-label";

describe("appPlanLabel", () => {
  it("shows the access tier instead of the latest question-pack name", () => {
    expect(
      appPlanLabel({ role: "USER", plan: "PRO", packageName: "Plus" }),
    ).toBe("Pro");
  });

  it("keeps staff roles and safe fallbacks", () => {
    expect(appPlanLabel({ role: "SUPER_ADMIN", plan: "PRO", packageName: "Plus" })).toBe(
      "Super Admin",
    );
    expect(appPlanLabel({ role: "USER", plan: "PRO", packageName: null })).toBe("Pro");
    expect(appPlanLabel({ role: "USER", plan: "FREE", packageName: null })).toBe("Free");
  });
});
