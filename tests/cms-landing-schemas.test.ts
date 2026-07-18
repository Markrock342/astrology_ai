import { describe, expect, it } from "vitest";
import {
  cmsLandingHeroSchema,
  cmsSeoSchema,
  cmsSiteFooterSchema,
} from "@/lib/admin-schemas";
import {
  CMS_DEFAULTS,
  CMS_KEYS,
  type CmsLandingHero,
} from "@/lib/cms-keys";
import { SAMPLE_LANDING_HERO_IMAGE } from "@/lib/landing-hero-bg";

const defaultHero = CMS_DEFAULTS[CMS_KEYS.landingHero] as CmsLandingHero;

describe("CMS landing schemas", () => {
  it("accepts default landing hero", () => {
    const parsed = cmsLandingHeroSchema.parse(defaultHero);
    expect(parsed.headline).toBeTruthy();
    expect(parsed.primaryCta.href).toContain("/login");
    expect(parsed.backgroundType).toBe("none");
  });

  it("accepts full-bleed image background from CMS media path", () => {
    const parsed = cmsLandingHeroSchema.parse({
      ...defaultHero,
      backgroundType: "image",
      backgroundImageUrl: "/api/media/hero123",
      backgroundOverlay: 40,
    });
    expect(parsed.backgroundImageUrl).toBe("/api/media/hero123");
  });

  it("accepts sample theme path and video file URL", () => {
    const image = cmsLandingHeroSchema.parse({
      ...defaultHero,
      backgroundType: "image",
      backgroundImageUrl: SAMPLE_LANDING_HERO_IMAGE,
    });
    expect(image.backgroundImageUrl).toBe(SAMPLE_LANDING_HERO_IMAGE);

    const video = cmsLandingHeroSchema.parse({
      ...defaultHero,
      backgroundType: "video",
      backgroundVideoUrl: "https://cdn.example.com/hero.mp4",
    });
    expect(video.backgroundVideoUrl).toContain(".mp4");
  });

  it("rejects image background without URL", () => {
    const result = cmsLandingHeroSchema.safeParse({
      ...defaultHero,
      backgroundType: "image",
      backgroundImageUrl: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects YouTube page URL as video background", () => {
    const result = cmsLandingHeroSchema.safeParse({
      ...defaultHero,
      backgroundType: "video",
      backgroundVideoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });
    expect(result.success).toBe(false);
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
