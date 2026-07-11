import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { FaqTeaser } from "@/components/marketing/faq-teaser";
import { FeaturesSection } from "@/components/marketing/features-section";
import { HeroSection } from "@/components/marketing/hero-section";
import { HowItWorksSection } from "@/components/marketing/how-it-works-section";
import { PricingSection } from "@/components/marketing/pricing-section";
import { TestimonialsSection } from "@/components/marketing/testimonials-section";
import {
  CMS_KEYS,
  type CmsLandingFeatures,
  type CmsLandingHero,
  type CmsLandingHowItWorks,
  type CmsLandingPricingSection,
  type CmsLandingTestimonials,
  type CmsSeo,
} from "@/lib/cms-keys";
import { AppError } from "@/lib/errors";
import { metadataFromSeo } from "@/lib/seo";
import { listPublicPackages } from "@/server/admin/catalog-admin-service";
import { resolveAppEntryPath } from "@/server/auth/app-entry";
import { isPreviewMode } from "@/server/cms/preview-mode";
import {
  getDraftSetting,
  getFaqForPublic,
  getPublishedSetting,
  getSeoForPath,
} from "@/server/settings/settings-service";
import { getMe } from "@/server/user/account-service";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const seo =
    (await getSeoForPath("/")) ??
    ((await getPublishedSetting(CMS_KEYS.seoHome)) as CmsSeo);
  return metadataFromSeo(seo);
}

/**
 * Public landing page. Logged-in users skip straight to onboarding or chat;
 * visitors see CMS-driven marketing sections.
 */
export default async function LandingPage() {
  const session = await auth();
  if (session?.user?.id) {
    try {
      await getMe(session.user.id);
      redirect(await resolveAppEntryPath(session.user.id));
    } catch (err) {
      if (!(err instanceof AppError && err.code === "NOT_FOUND")) throw err;
    }
  }

  const preview = await isPreviewMode();
  const cms = <K extends typeof CMS_KEYS[keyof typeof CMS_KEYS]>(key: K) =>
    preview ? getDraftSetting(key) : getPublishedSetting(key);

  const [hero, features, how, pricingSection, testimonials, packages, faqItems] =
    await Promise.all([
      cms(CMS_KEYS.landingHero) as Promise<CmsLandingHero>,
      cms(CMS_KEYS.landingFeatures) as Promise<CmsLandingFeatures>,
      cms(CMS_KEYS.landingHowItWorks) as Promise<CmsLandingHowItWorks>,
      cms(CMS_KEYS.landingPricingSection) as Promise<CmsLandingPricingSection>,
      cms(CMS_KEYS.landingTestimonials) as Promise<CmsLandingTestimonials>,
      listPublicPackages(),
      getFaqForPublic(preview),
    ]);

  return (
    <main className="flex flex-1 flex-col">
      <HeroSection hero={hero} />
      <FeaturesSection features={features} />
      <HowItWorksSection how={how} />
      <PricingSection section={pricingSection} packages={packages} compact />
      <TestimonialsSection testimonials={testimonials} />
      <FaqTeaser items={faqItems} />
    </main>
  );
}
