import type { MetadataRoute } from "next";

const FALLBACK_BASE = "https://astrology-ai-three.vercel.app";

function siteBaseUrl(): string {
  const raw =
    process.env.APP_BASE_URL || process.env.AUTH_URL || FALLBACK_BASE;
  return raw.replace(/\/$/, "");
}

export default function robots(): MetadataRoute.Robots {
  const base = siteBaseUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/", "/dashboard", "/history", "/onboarding", "/account", "/reading"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
