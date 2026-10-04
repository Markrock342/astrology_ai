import { describe, expect, it } from "vitest";
import { packageUpdateSchema, knowledgeUpdateSchema, categoryUpdateSchema } from "@/lib/admin-schemas";

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
});
