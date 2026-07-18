import { describe, expect, it } from "vitest";
import {
  isDirectVideoFileUrl,
  isPageEmbedVideoUrl,
  resolveHeroBackground,
  SAMPLE_LANDING_HERO_IMAGE,
  sampleThemeHeroPatch,
} from "@/lib/landing-hero-bg";

describe("landing-hero-bg helpers", () => {
  it("treats empty URL as no media", () => {
    expect(
      resolveHeroBackground({
        backgroundType: "image",
        backgroundImageUrl: "  ",
      }).missingMedia,
    ).toBe(true);
    expect(
      resolveHeroBackground({
        backgroundType: "image",
        backgroundImageUrl: "  ",
      }).hasFullBleed,
    ).toBe(false);
  });

  it("resolves sample theme image as full-bleed", () => {
    const patch = sampleThemeHeroPatch();
    const bg = resolveHeroBackground(patch);
    expect(patch.backgroundImageUrl).toBe(SAMPLE_LANDING_HERO_IMAGE);
    expect(bg.hasFullBleed).toBe(true);
    expect(bg.imageSrc).toBe(SAMPLE_LANDING_HERO_IMAGE);
    expect(bg.missingMedia).toBe(false);
  });

  it("accepts direct mp4/webm URLs and rejects YouTube", () => {
    expect(isDirectVideoFileUrl("https://cdn.example.com/hero.mp4")).toBe(true);
    expect(isDirectVideoFileUrl("/clips/hero.webm")).toBe(true);
    expect(isDirectVideoFileUrl("https://cdn.example.com/hero.mp4?token=1")).toBe(
      true,
    );
    expect(
      isPageEmbedVideoUrl("https://www.youtube.com/watch?v=abc123"),
    ).toBe(true);
    expect(isDirectVideoFileUrl("https://www.youtube.com/watch?v=abc123")).toBe(
      false,
    );
  });

  it("marks invalid video URL when type is video but URL is embed page", () => {
    const bg = resolveHeroBackground({
      backgroundType: "video",
      backgroundVideoUrl: "https://youtu.be/abc123",
    });
    expect(bg.invalidVideoUrl).toBe(true);
    expect(bg.hasFullBleed).toBe(false);
    expect(bg.videoSrc).toBeNull();
  });

  it("hides inset image when full-bleed is active", () => {
    const bg = resolveHeroBackground({
      backgroundType: "image",
      backgroundImageUrl: "/samples/landing-hero-bg.jpg",
      imageUrl: "/inset.png",
    });
    expect(bg.insetImage).toBeNull();
  });
});
