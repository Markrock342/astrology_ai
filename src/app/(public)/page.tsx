import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FaqTeaser } from "@/components/marketing/faq-teaser";
import { FeaturesSection } from "@/components/marketing/features-section";
import { HeroSection } from "@/components/marketing/hero-section";
import { HowItWorksSection } from "@/components/marketing/how-it-works-section";
import { PricingSection } from "@/components/marketing/pricing-section";
import { TestimonialsSection } from "@/components/marketing/testimonials-section";
import {
  CMS_DEFAULTS,
  CMS_KEYS,
  type CmsLandingFeatures,
  type CmsLandingHero,
  type CmsLandingHowItWorks,
  type CmsLandingPricingSection,
  type CmsLandingTestimonials,
  type CmsSeo,
} from "@/lib/cms-keys";
import { metadataFromSeo } from "@/lib/seo";
import { listPublicPackages } from "@/server/admin/catalog-admin-service";
import { resolveAppEntryPath } from "@/server/auth/app-entry";
import { getSessionOrNull } from "@/server/auth/session";
import { isPreviewMode } from "@/server/cms/preview-mode";
import { shouldRedirectLoggedInFromLanding } from "@/server/cms/landing-preview-policy";
import {
  getDraftSetting,
  getFaqForPublic,
  getPublishedSetting,
  getSeoForPath,
} from "@/server/settings/settings-service";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const seo =
    (await getSeoForPath("/").catch(() => null)) ??
    ((await getPublishedSetting(CMS_KEYS.seoHome)) as CmsSeo);
  return metadataFromSeo(seo);
}

/**
 * Public landing page. Logged-in users skip straight to onboarding or chat —
 * except when admin CMS preview mode is active (see "ดูตัวอย่าง").
 *
 * If DevTools shows JWTSessionError / "no matching decryption secret", delete
 * the localhost session cookie (Application → Cookies) then refresh / sign in.
 */
export default async function LandingPage() {
  const preview = await isPreviewMode();
  const session = await getSessionOrNull();
  // Preview must win over the logged-in redirect — otherwise "ดูตัวอย่าง"
  // from /admin/landing always lands on /dashboard chat.
  if (
    shouldRedirectLoggedInFromLanding({
      isLoggedIn: Boolean(session?.user?.id),
      isPreview: preview,
    })
  ) {
    redirect(await resolveAppEntryPath(session!.user!.id));
  }

  const cms = <K extends typeof CMS_KEYS[keyof typeof CMS_KEYS]>(key: K) =>
    preview ? getDraftSetting(key) : getPublishedSetting(key);

  const [hero, features, how, pricingSection, testimonials, packages, faqItems] =
    await Promise.all([
      cms(CMS_KEYS.landingHero) as Promise<CmsLandingHero>,
      cms(CMS_KEYS.landingFeatures) as Promise<CmsLandingFeatures>,
      cms(CMS_KEYS.landingHowItWorks) as Promise<CmsLandingHowItWorks>,
      cms(CMS_KEYS.landingPricingSection) as Promise<CmsLandingPricingSection>,
      cms(CMS_KEYS.landingTestimonials) as Promise<CmsLandingTestimonials>,
      listPublicPackages().catch(() => []),
      getFaqForPublic(preview),
    ]);

  return (
    <main className="flex flex-1 flex-col">
      {preview && (
        <div className="border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-200">
          โหมดดูตัวอย่าง (แบบร่าง) — ผู้เยี่ยมชมทั่วไปยังเห็นเวอร์ชันที่เผยแพร่แล้ว
        </div>
      )}
      <HeroSection hero={hero ?? (CMS_DEFAULTS[CMS_KEYS.landingHero] as CmsLandingHero)} />
      <FeaturesSection
        features={features ?? (CMS_DEFAULTS[CMS_KEYS.landingFeatures] as CmsLandingFeatures)}
      />
      <HowItWorksSection
        how={how ?? (CMS_DEFAULTS[CMS_KEYS.landingHowItWorks] as CmsLandingHowItWorks)}
      />
      <PricingSection
        section={
          pricingSection ??
          (CMS_DEFAULTS[CMS_KEYS.landingPricingSection] as CmsLandingPricingSection)
        }
        packages={packages}
        compact
      />
      <TestimonialsSection
        testimonials={
          testimonials ??
          (CMS_DEFAULTS[CMS_KEYS.landingTestimonials] as CmsLandingTestimonials)
        }
      />
      <FaqTeaser items={faqItems} />
    </main>
  );
}
