import { describe, expect, it } from "vitest";
import { absoluteAssetUrl, metadataFromSeo } from "@/lib/seo";

describe("metadataFromSeo share image", () => {
  const seo = {
    title: "โหราศาสตร์",
    description: "ดูดวง AI",
    ogTitle: "โหราศาสตร์ (HoraSard)",
    ogDescription: "ดูดวง AI ออนไลน์",
  };

  it("falls back to brand mark when ogImageUrl is empty", () => {
    const meta = metadataFromSeo(seo);
    const images = meta.openGraph?.images;
    const first = Array.isArray(images) ? images[0] : images;
    const url = typeof first === "object" && first && "url" in first ? first.url : first;
    expect(String(url)).toMatch(/\/logo\.png$/);
  });

  it("prefers explicit ogImageUrl", () => {
    const meta = metadataFromSeo({
      ...seo,
      ogImageUrl: "https://cdn.example.com/share.png",
    });
    const images = meta.openGraph?.images;
    const first = Array.isArray(images) ? images[0] : images;
    const url = typeof first === "object" && first && "url" in first ? first.url : first;
    expect(String(url)).toBe("https://cdn.example.com/share.png");
  });

  it("absoluteAssetUrl joins relative paths to the site origin", () => {
    expect(absoluteAssetUrl("/logo.png")).toMatch(/^https?:\/\/.+\/logo\.png$/);
  });
});
