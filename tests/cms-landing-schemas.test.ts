import { describe, expect, it } from "vitest";
import {
  cmsLandingHeroSchema,
  cmsSeoSchema,
  cmsSiteFooterSchema,
} from "@/lib/admin-schemas";
import { CMS_DEFAULTS, CMS_KEYS } from "@/lib/cms-keys";

describe("CMS landing schemas", () => {
  it("accepts default landing hero", () => {
    const parsed = cmsLandingHeroSchema.parse(CMS_DEFAULTS[CMS_KEYS.landingHero]);
    expect(parsed.headline).toBeTruthy();
    expect(parsed.primaryCta.href).toContain("/login");
  });

  it("rejects SEO title over 60 chars", () => {
    expect(() =>
      cmsSeoSchema.parse({
        title: "x".repeat(61),
        description: "ok description here",
      }),
    ).toThrow();
  });

  it("accepts default site footer", () => {
    const parsed = cmsSiteFooterSchema.parse(CMS_DEFAULTS[CMS_KEYS.siteFooter]);
    expect(parsed.links.length).toBeGreaterThan(0);
  });
});
