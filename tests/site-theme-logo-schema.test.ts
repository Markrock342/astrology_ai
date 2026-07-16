import { describe, expect, it } from "vitest";
import { cmsSiteThemeSchema } from "@/lib/admin-schemas";
import { resolveBrandUrls } from "@/lib/brand-assets";
import type { CmsSiteTheme } from "@/lib/cms-keys";

describe("site theme logo schema", () => {
  it("accepts relative /api/media paths for logos", () => {
    const parsed = cmsSiteThemeSchema.parse({
      enabled: false,
      primary: "#c9a24b",
      secondary: "#1f8f7a",
      backgroundDark: "#0d0d0f",
      backgroundLight: "#f3f4f6",
      markUrl: "/api/media/abc123",
      wordmarkUrl: "/api/media/def456",
    });
    expect(parsed.markUrl).toBe("/api/media/abc123");
  });

  it("accepts null / empty logos (fallback to static)", () => {
    expect(
      cmsSiteThemeSchema.parse({
        enabled: false,
        primary: "#c9a24b",
        secondary: "#1f8f7a",
        backgroundDark: "#0d0d0f",
        backgroundLight: "#f3f4f6",
        markUrl: null,
        wordmarkUrl: "",
      }).wordmarkUrl,
    ).toBe("");
  });

  it("rejects invalid urls", () => {
    expect(() =>
      cmsSiteThemeSchema.parse({
        enabled: false,
        primary: "#c9a24b",
        secondary: "#1f8f7a",
        backgroundDark: "#0d0d0f",
        backgroundLight: "#f3f4f6",
        markUrl: "not-a-url",
      }),
    ).toThrow();
  });

  it("resolveBrandUrls falls back to static assets", () => {
    const theme: CmsSiteTheme = {
      enabled: false,
      primary: "#c9a24b",
      secondary: "#1f8f7a",
      backgroundDark: "#0d0d0f",
      backgroundLight: "#f3f4f6",
      markUrl: null,
      wordmarkUrl: "  ",
    };
    expect(resolveBrandUrls(theme)).toEqual({
      markUrl: "/logo.png",
      wordmarkUrl: "/wordmark.png",
    });

    expect(
      resolveBrandUrls({
        ...theme,
        markUrl: "https://cdn.example/m.png",
        wordmarkUrl: "https://cdn.example/w.png",
      }),
    ).toEqual({
      markUrl: "https://cdn.example/m.png",
      wordmarkUrl: "https://cdn.example/w.png",
    });
  });
});
