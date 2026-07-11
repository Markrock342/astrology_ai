import type { MetadataRoute } from "next";

const FALLBACK_BASE = "https://astrology-ai-three.vercel.app";

function siteBaseUrl(): string {
  const raw =
    process.env.APP_BASE_URL || process.env.AUTH_URL || FALLBACK_BASE;
  return raw.replace(/\/$/, "");
}

const PATHS = [
  "/",
  "/pricing",
  "/help",
  "/privacy",
  "/terms",
  "/disclaimer",
  "/contact",
  "/login",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteBaseUrl();
  const now = new Date();
  return PATHS.map((path) => ({
    url: `${base}${path === "/" ? "" : path}`,
    lastModified: now,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : path === "/pricing" || path === "/login" ? 0.8 : 0.6,
  }));
}
