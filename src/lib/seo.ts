import type { Metadata } from "next";
import { DEFAULT_BRAND_MARK } from "@/lib/brand-assets";
import type { CmsSeo } from "@/lib/cms-keys";

function siteBaseUrl(): string {
  const raw =
    process.env.APP_BASE_URL ||
    process.env.AUTH_URL ||
    "https://horasard.com";
  return raw.replace(/\/$/, "");
}

/** LINE/Facebook need an absolute image URL. */
export function absoluteAssetUrl(url: string | undefined): string | undefined {
  const trimmed = url?.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `${siteBaseUrl()}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
}

/** Build Next.js metadata from CMS SEO settings. */
export function metadataFromSeo(
  seo: CmsSeo,
  opts?: { fallbackImageUrl?: string },
): Metadata {
  const title = seo.title;
  const description = seo.description;
  const ogTitle = seo.ogTitle ?? title;
  const ogDescription = seo.ogDescription ?? description;
  const image =
    absoluteAssetUrl(seo.ogImageUrl) ??
    absoluteAssetUrl(opts?.fallbackImageUrl) ??
    absoluteAssetUrl(DEFAULT_BRAND_MARK);

  return {
    title,
    description,
    metadataBase: new URL(siteBaseUrl()),
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      type: "website",
      locale: "th_TH",
      siteName: "HoraSard",
      ...(image
        ? { images: [{ url: image, alt: ogTitle, width: 512, height: 512 }] }
        : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: ogTitle,
      description: ogDescription,
      ...(image ? { images: [image] } : {}),
    },
  };
}
