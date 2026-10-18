import { describe, expect, it } from "vitest";
import {
  categoryUpdateSchema,
  knowledgeUpdateSchema,
  packageUpdateSchema,
  paymentReviewSchema,
} from "@/lib/admin-schemas";

describe("admin update schemas touch only the fields sent", () => {
  it("saving a package from the form (no type sent) keeps it PRO", () => {
    const body = { name: "Pro", price: 199, usageBudgetUnits: 1_111_111, enabled: true, features: [] };
    const data = packageUpdateSchema.parse(body);
    expect(data).not.toHaveProperty("type");
    expect(data).not.toHaveProperty("creditOnly");
  });

  it("toggling a knowledge doc does not reset its sort order", () => {
    expect(knowledgeUpdateSchema.parse({ enabled: false })).toEqual({ enabled: false });
  });

  it("disabling a category does not reset its plan or cost", () => {
    expect(categoryUpdateSchema.parse({ enabled: false })).toEqual({ enabled: false });
  });

  it("still validates what is sent", () => {
    expect(packageUpdateSchema.safeParse({ type: "GOLD" }).success).toBe(false);
  });

  it("requires a reason only when rejecting a payment", () => {
    expect(paymentReviewSchema.safeParse({ status: "APPROVED" }).success).toBe(true);
    expect(paymentReviewSchema.safeParse({ status: "REJECTED" }).success).toBe(false);
    expect(
      paymentReviewSchema.safeParse({ status: "REJECTED", note: "สลิปไม่ตรงยอด" }).success,
    ).toBe(true);
  });
});
