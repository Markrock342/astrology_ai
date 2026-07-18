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
    expect(parsed.backgroundType).toBe("none");
  });

  it("accepts full-bleed image background from CMS media path", () => {
    const parsed = cmsLandingHeroSchema.parse({
      ...CMS_DEFAULTS[CMS_KEYS.landingHero],
      backgroundType: "image",
      backgroundImageUrl: "/api/media/hero123",
      backgroundOverlay: 40,
    });
    expect(parsed.backgroundImageUrl).toBe("/api/media/hero123");
  });

  it("accepts video background URL", () => {
    const parsed = cmsLandingHeroSchema.parse({
      ...CMS_DEFAULTS[CMS_KEYS.landingHero],
      backgroundType: "video",
      backgroundVideoUrl: "https://cdn.example.com/hero.mp4",
    });
    expect(parsed.backgroundVideoUrl).toContain(".mp4");
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
