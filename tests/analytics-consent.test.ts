import { describe, expect, it } from "vitest";
import { analyticsPagePath, validGaId } from "@/lib/analytics-consent";

describe("GA4 guard rails", () => {
  it("accepts only a GA4 measurement id", () => {
    expect(validGaId("G-AB12CD34EF")).toBe("G-AB12CD34EF");
    expect(validGaId(" G-AB12CD34EF ")).toBe("G-AB12CD34EF");
    expect(validGaId("")).toBeNull();
    expect(validGaId(undefined)).toBeNull();
    expect(validGaId("UA-1234-1")).toBeNull();
    expect(validGaId("G-x');alert(1)//")).toBeNull();
  });

  it("never measures admin pages", () => {
    expect(analyticsPagePath("/admin")).toBeNull();
    expect(analyticsPagePath("/admin/analytics")).toBeNull();
    expect(analyticsPagePath("/administrator-guide")).toBe("/administrator-guide");
    expect(analyticsPagePath("/reset-password")).toBe("/reset-password");
    expect(analyticsPagePath("")).toBe("/");
  });
});
