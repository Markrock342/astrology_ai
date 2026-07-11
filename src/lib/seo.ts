import type { Metadata } from "next";
import type { CmsSeo } from "@/lib/cms-keys";

/** Build Next.js metadata from CMS SEO settings. */
export function metadataFromSeo(seo: CmsSeo): Metadata {
  const title = seo.title;
  const description = seo.description;
  const ogTitle = seo.ogTitle ?? title;
  const ogDescription = seo.ogDescription ?? description;

  return {
    title,
    description,
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      ...(seo.ogImageUrl ? { images: [{ url: seo.ogImageUrl }] } : {}),
    },
    twitter: {
      card: seo.ogImageUrl ? "summary_large_image" : "summary",
      title: ogTitle,
      description: ogDescription,
      ...(seo.ogImageUrl ? { images: [seo.ogImageUrl] } : {}),
    },
  };
}
