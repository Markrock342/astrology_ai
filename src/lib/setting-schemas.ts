import { CMS_KEYS } from "@/lib/cms-keys";
import {
  cmsContactSchema,
  cmsDocumentSchema,
  cmsLandingFeaturesSchema,
  cmsLandingHeroSchema,
  cmsLandingHowItWorksSchema,
  cmsLandingPricingSectionSchema,
  cmsLandingTestimonialsSchema,
  cmsMaintenanceSchema,
  cmsPaymentInfoSchema,
  cmsSeoSchema,
  cmsSiteFooterSchema,
  cmsTextSchema,
} from "@/lib/admin-schemas";
import type { z } from "zod";

/** Shared CMS setting value schemas for draft/publish/update routes. */
export const SETTING_VALUE_SCHEMA_BY_KEY: Record<string, z.ZodType> = {
  [CMS_KEYS.privacyPolicy]: cmsDocumentSchema,
  [CMS_KEYS.termsOfService]: cmsDocumentSchema,
  [CMS_KEYS.disclaimer]: cmsDocumentSchema,
  [CMS_KEYS.consentRegister]: cmsTextSchema,
  [CMS_KEYS.consentBirthPrivacy]: cmsTextSchema,
  [CMS_KEYS.consentBirthEditLimit]: cmsTextSchema,
  [CMS_KEYS.contact]: cmsContactSchema,
  [CMS_KEYS.maintenanceMode]: cmsMaintenanceSchema,
  [CMS_KEYS.paymentInfo]: cmsPaymentInfoSchema,
  [CMS_KEYS.seoHome]: cmsSeoSchema,
  [CMS_KEYS.seoPrivacy]: cmsSeoSchema,
  [CMS_KEYS.seoTerms]: cmsSeoSchema,
  [CMS_KEYS.seoDisclaimer]: cmsSeoSchema,
  [CMS_KEYS.seoFaq]: cmsSeoSchema,
  [CMS_KEYS.seoPricing]: cmsSeoSchema,
  [CMS_KEYS.seoContact]: cmsSeoSchema,
  [CMS_KEYS.landingHero]: cmsLandingHeroSchema,
  [CMS_KEYS.landingFeatures]: cmsLandingFeaturesSchema,
  [CMS_KEYS.landingHowItWorks]: cmsLandingHowItWorksSchema,
  [CMS_KEYS.landingPricingSection]: cmsLandingPricingSectionSchema,
  [CMS_KEYS.landingTestimonials]: cmsLandingTestimonialsSchema,
  [CMS_KEYS.siteFooter]: cmsSiteFooterSchema,
};
