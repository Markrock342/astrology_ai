/**
 * CMS content keys stored in `app_settings`. Admin edits these in /admin/settings
 * and /admin/landing; public pages read via settings-service.
 */

export type CmsSection = { heading: string; body: string[] };

/** Structured legal/document page (privacy, terms). */
export type CmsDocument = {
  title: string;
  lastUpdated: string;
  intro: string;
  sections: CmsSection[];
  footer?: string;
};

export type CmsText = { text: string };

export type CmsContact = { email: string; label?: string };

export type CmsMaintenance = { enabled: boolean; message: string };

export type CmsPaymentInfo = {
  title: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  amountNote: string;
  steps: string[];
  footer?: string;
};

/** SEO metadata for public pages (title, description, Open Graph). */
export type CmsSeo = {
  title: string;
  description: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImageUrl?: string;
};

export type CmsCta = { text: string; href: string };

export type CmsLandingHero = {
  eyebrow: string;
  headline: string;
  subheadline: string;
  primaryCta: CmsCta;
  secondaryCta: CmsCta;
  imageUrl?: string;
};

export type CmsLandingFeature = {
  icon: string;
  title: string;
  description: string;
};

export type CmsLandingFeatures = {
  title: string;
  subtitle?: string;
  items: CmsLandingFeature[];
};

export type CmsLandingStep = {
  title: string;
  description: string;
};

export type CmsLandingHowItWorks = {
  title: string;
  subtitle?: string;
  steps: CmsLandingStep[];
};

export type CmsLandingPricingSection = {
  title: string;
  subtitle?: string;
  /** When false, hide the pricing section on the landing page. */
  enabled: boolean;
};

export type CmsLandingTestimonial = {
  name: string;
  quote: string;
  stars: number;
};

export type CmsLandingTestimonials = {
  title: string;
  subtitle?: string;
  enabled: boolean;
  items: CmsLandingTestimonial[];
};

export type CmsFooterLink = { label: string; href: string };

export type CmsSiteFooter = {
  brandBlurb: string;
  copyright: string;
  links: CmsFooterLink[];
  socialLinks: CmsFooterLink[];
};

/** Site-wide brand colors — admin sets once, all users see the same. */
export type CmsSiteTheme = {
  /** When true, override default palette for every visitor. */
  enabled: boolean;
  primary: string;
  secondary: string;
  backgroundDark: string;
  backgroundLight: string;
};

export const CMS_KEYS = {
  privacyPolicy: "privacy_policy",
  termsOfService: "terms_of_service",
  disclaimer: "disclaimer",
  consentRegister: "consent_register",
  consentBirthPrivacy: "consent_birth_privacy",
  consentBirthEditLimit: "consent_birth_edit_limit",
  contact: "contact",
  maintenanceMode: "maintenance_mode",
  siteTheme: "site_theme",
  paymentInfo: "payment_info",
  seoHome: "seo_home",
  seoPrivacy: "seo_privacy",
  seoTerms: "seo_terms",
  seoDisclaimer: "seo_disclaimer",
  seoFaq: "seo_faq",
  seoPricing: "seo_pricing",
  seoContact: "seo_contact",
  landingHero: "landing_hero",
  landingFeatures: "landing_features",
  landingHowItWorks: "landing_how_it_works",
  landingPricingSection: "landing_pricing_section",
  landingTestimonials: "landing_testimonials",
  siteFooter: "site_footer",
} as const;

export type CmsKey = (typeof CMS_KEYS)[keyof typeof CMS_KEYS];

/** Keys readable without authentication. */
export const PUBLIC_CMS_KEYS: CmsKey[] = [
  CMS_KEYS.privacyPolicy,
  CMS_KEYS.termsOfService,
  CMS_KEYS.disclaimer,
  CMS_KEYS.consentRegister,
  CMS_KEYS.consentBirthPrivacy,
  CMS_KEYS.consentBirthEditLimit,
  CMS_KEYS.contact,
  CMS_KEYS.paymentInfo,
  CMS_KEYS.siteTheme,
  CMS_KEYS.landingHero,
  CMS_KEYS.landingFeatures,
  CMS_KEYS.landingHowItWorks,
  CMS_KEYS.landingPricingSection,
  CMS_KEYS.landingTestimonials,
  CMS_KEYS.siteFooter,
];

export const CMS_DEFAULTS: Record<CmsKey, unknown> = {
  [CMS_KEYS.privacyPolicy]: {
    title: "นโยบายความเป็นส่วนตัวและเงื่อนไขการใช้งาน",
    lastUpdated: "4 กรกฎาคม 2568",
    intro:
      "โหราศาสตร์ (HoraSard) ให้ความสำคัญกับความเป็นส่วนตัวของคุณ เอกสารนี้อธิบายว่าเราเก็บ ใช้ และดูแลข้อมูลของคุณอย่างไร",
    sections: [
      {
        heading: "1. ข้อมูลที่เราเก็บ",
        body: [
          "ข้อมูลบัญชี: อีเมล ชื่อผู้ใช้ และรหัสผ่าน (จัดเก็บแบบเข้ารหัส ไม่เก็บเป็นข้อความปกติ)",
          "ข้อมูลวันเกิด: วัน/เดือน/ปีเกิด เวลาเกิด และสถานที่เกิด (ประเทศ/จังหวัด/อำเภอ) เพื่อใช้คำนวณและทำนายดวง",
          "ข้อมูลการใช้งาน: ประวัติการสนทนากับ AI หมวดที่เลือก และการทำรายการเครดิต/แพ็กเกจ",
        ],
      },
      {
        heading: "2. วัตถุประสงค์ในการใช้ข้อมูล",
        body: [
          "ให้บริการทำนายดวงและสนทนากับ AI ตามข้อมูลวันเกิดของคุณ",
          "ยืนยันตัวตน จัดการบัญชี และดูแลความปลอดภัยของระบบ",
          "ปรับปรุงคุณภาพบริการและวิเคราะห์การใช้งานโดยรวม",
        ],
      },
      {
        heading: "3. การเปิดเผยข้อมูล",
        body: [
          "เราไม่ขายข้อมูลส่วนบุคคลของคุณให้บุคคลที่สาม",
          "เราอาจใช้ผู้ให้บริการภายนอกที่จำเป็น เช่น ระบบส่งอีเมลและผู้ให้บริการ AI ภายใต้ข้อตกลงรักษาความลับ",
          "เราอาจเปิดเผยข้อมูลเมื่อมีข้อกำหนดตามกฎหมายหรือคำสั่งของหน่วยงานที่มีอำนาจ",
        ],
      },
      {
        heading: "4. สิทธิของคุณ",
        body: [
          "ขอเข้าถึง แก้ไข หรือลบข้อมูลส่วนบุคคลของคุณได้",
          "แก้ไขข้อมูลวันเกิดได้จำกัดจำนวนครั้งตามที่ระบบกำหนด เพื่อป้องกันการใช้วันเกิดของผู้อื่น",
          "ขอลบบัญชีได้โดยติดต่อทีมงานผ่านช่องทางด้านล่าง",
        ],
      },
      {
        heading: "5. การเก็บรักษาและความปลอดภัย",
        body: [
          "เราจัดเก็บข้อมูลบนระบบที่มีการควบคุมการเข้าถึง และเข้ารหัสข้อมูลสำคัญ เช่น รหัสผ่าน",
          "เราเก็บข้อมูลไว้เท่าที่จำเป็นต่อการให้บริการหรือตามที่กฎหมายกำหนด",
        ],
      },
      {
        heading: "6. ข้อจำกัดความรับผิด (Disclaimer)",
        body: [
          "บริการของโหราศาสตร์ (HoraSard) มีวัตถุประสงค์เพื่อความบันเทิงและการไตร่ตรองส่วนบุคคลเท่านั้น",
          "คำทำนายไม่ใช่คำแนะนำทางการแพทย์ การเงิน กฎหมาย หรือการตัดสินใจสำคัญในชีวิต โปรดใช้วิจารณญาณ",
        ],
      },
      {
        heading: "7. การติดต่อ",
        body: [
          "หากมีคำถามเกี่ยวกับนโยบายความเป็นส่วนตัวนี้ หรือต้องการใช้สิทธิของคุณ กรุณาติดต่อทีมงานผ่านอีเมลที่แจ้งไว้ในแอป",
        ],
      },
    ],
    footer:
      "เอกสารนี้อาจมีการปรับปรุงรายละเอียด — วันที่ปรับปรุงล่าสุดแสดงด้านบน",
  } satisfies CmsDocument,
  [CMS_KEYS.termsOfService]: {
    title: "เงื่อนไขการใช้บริการ",
    lastUpdated: "11 กรกฎาคม 2569",
    intro:
      "การเข้าใช้งานและใช้บริการ Horasard (โหราศาสตร์) ถือว่าท่านยอมรับและตกลงปฏิบัติตามเงื่อนไขการใช้บริการนี้",
    sections: [
      {
        heading: "1. การยอมรับเงื่อนไข",
        body: [
          "การเข้าใช้งานและใช้บริการของ Horasard (โหราศาสตร์) ถือว่าท่านยอมรับและตกลงปฏิบัติตามเงื่อนไขการใช้บริการนี้",
          "หากท่านไม่ยอมรับเงื่อนไข โปรดงดเว้นจากการใช้บริการ",
        ],
      },
      {
        heading: "2. วัตถุประสงค์ของบริการ",
        body: [
          "Horasard ให้บริการดูดวงและการสนทนากับ AI เพื่อความบันเทิงและเป็นแนวทางในการวางแผนชีวิตเท่านั้น",
          "ข้อมูลที่ได้รับไม่ใช่การพยากรณ์ที่ถูกต้องเสมอไป และไม่ควรนำไปใช้เป็นการตัดสินใจที่สำคัญในชีวิตโดยตรง",
        ],
      },
      {
        heading: "3. ความรับผิดชอบของผู้ใช้",
        body: [
          "ผู้ใช้ต้องให้ข้อมูลที่ถูกต้องและเป็นจริง รวมถึงวันเกิดและข้อมูลส่วนตัวอื่นๆ",
          "ห้ามใช้บริการเพื่อวัตถุประสงค์ที่ผิดกฎหมาย หรือเป็นการล่วงละเมิดสิทธิของบุคคลอื่น",
        ],
      },
      {
        heading: "4. การเก็บข้อมูลและความเป็นส่วนตัว",
        body: [
          "เราเก็บข้อมูลส่วนตัวของท่านตามที่ระบุในนโยบายความเป็นส่วนตัว",
          "เราจะไม่เปิดเผยข้อมูลดังกล่าวให้บุคคลภายนอกโดยไม่ได้รับความยินยอม ยกเว้นกรณีที่กฎหมายกำหนด",
        ],
      },
      {
        heading: "5. การชำระเงินและเครดิต",
        body: [
          "การซื้อแพ็กเกจและเครดิตเป็นการซื้อครั้งเดียวและไม่สามารถขอคืนเงินได้ ยกเว้นกรณีที่ระบบมีข้อผิดพลาดที่ทำให้ไม่สามารถใช้บริการได้",
          "เครดิตที่ซื้อจะหมดอายุตามระยะเวลาที่กำหนดในแต่ละแพ็กเกจ",
        ],
      },
      {
        heading: "6. การแก้ไขและยกเลิกบัญชี",
        body: [
          "ผู้ใช้สามารถแก้ไขข้อมูลวันเกิดได้จำกัดจำนวนครั้งตามที่ระบบกำหนด",
          "หากต้องการลบบัญชี สามารถติดต่อทีมงานผ่านช่องทางที่ระบุไว้ — การลบบัญชีจะเป็นการลบข้อมูลถาวรและไม่สามารถกู้คืนได้",
        ],
      },
      {
        heading: "7. การเปลี่ยนแปลงเงื่อนไข",
        body: [
          "Horasard ขอสงวนสิทธิ์ในการแก้ไขหรือเปลี่ยนแปลงเงื่อนไขการใช้บริการ",
          "หากมีการเปลี่ยนแปลงสำคัญ เราจะแจ้งให้ท่านทราบผ่านอีเมลหรือทางเว็บไซต์ — การใช้งานต่อเนื่องหลังจากมีการเปลี่ยนแปลงถือว่าท่านยอมรับเงื่อนไขใหม่",
        ],
      },
      {
        heading: "8. การจำกัดความรับผิด",
        body: [
          "Horasard ไม่รับผิดชอบต่อความเสียหายใดๆ ที่เกิดจากการใช้หรือไม่สามารถใช้บริการได้",
          "รวมถึงความถูกต้องของข้อมูลการทำนายที่ได้รับจากระบบ — ทุกการตัดสินใจเป็นความรับผิดชอบของผู้ใช้เอง",
        ],
      },
    ],
    footer: "เอกสารนี้อาจมีการปรับปรุงรายละเอียด — วันที่ปรับปรุงล่าสุดแสดงด้านบน",
  } satisfies CmsDocument,
  [CMS_KEYS.disclaimer]: {
    title: "ข้อจำกัดความรับผิด",
    lastUpdated: "11 กรกฎาคม 2569",
    intro: "⚠️ บริการนี้ให้บริการเพื่อความบันเทิงเท่านั้น",
    sections: [
      {
        heading: "1. วัตถุประสงค์เพื่อความบันเทิง",
        body: [
          "Horasard (โหราศาสตร์) เป็นบริการดูดวงและการสนทนากับ AI ที่จัดทำขึ้นเพื่อความบันเทิงและเป็นแนวทางในการวางแผนชีวิตเท่านั้น",
          "ข้อมูลที่ได้รับจากบริการนี้ไม่ใช่การพยากรณ์ที่ถูกต้องเสมอไป และไม่ควรนำไปใช้เป็นการตัดสินใจที่สำคัญในชีวิตโดยตรง",
        ],
      },
      {
        heading: "2. ความถูกต้องของข้อมูล",
        body: [
          "ข้อมูลการทำนายดวงและคำแนะนำที่ได้รับจากระบบ AI อาจมีความคลาดเคลื่อนหรือไม่ถูกต้องตามความเป็นจริง",
          "Horasard ไม่รับประกันความถูกต้อง ความสมบูรณ์ หรือความเหมาะสมของข้อมูลใดๆ ที่ให้บริการ",
        ],
      },
      {
        heading: "3. ไม่ใช่คำแนะนำทางการแพทย์ การเงิน หรือกฎหมาย",
        body: [
          "บริการนี้ไม่ใช่คำแนะนำทางการแพทย์ การเงิน การลงทุน หรือกฎหมาย",
          "หากท่านมีความต้องการด้านสุขภาพ การเงิน หรือกฎหมาย โปรดปรึกษาผู้เชี่ยวชาญในสาขาที่เกี่ยวข้องโดยตรง",
        ],
      },
      {
        heading: "4. การตัดสินใจเป็นความรับผิดชอบของผู้ใช้",
        body: [
          "การตัดสินใจใดๆ ที่เกิดจากข้อมูลหรือคำแนะนำจากบริการนี้เป็นความรับผิดชอบของผู้ใช้เองทั้งหมด",
          "Horasard จะไม่รับผิดชอบต่อความเสียหาย การสูญเสีย หรือผลกระทบใดๆ ที่เกิดจากการตัดสินใจดังกล่าว",
        ],
      },
      {
        heading: "5. การจำกัดความรับผิด",
        body: [
          "Horasard ไม่รับผิดชอบต่อความเสียหายใดๆ ที่เกิดจากการใช้หรือไม่สามารถใช้บริการได้",
          "รวมถึงแต่ไม่จำกัดเพียง ความเสียหายทางตรง ทางอ้อม บังเอิญ หรือเป็นผลต่อเนื่องที่เกิดจากการใช้บริการนี้",
        ],
      },
      {
        heading: "6. การใช้งานด้วยวิจารณญาณ",
        body: [
          "ผู้ใช้ควรใช้วิจารณญาณและพิจารณาข้อมูลจากบริการนี้อย่างรอบคอบ",
          "ไม่ควรพึ่งพาข้อมูลจากบริการนี้อย่างเดียวในการตัดสินใจที่สำคัญ และควรหาข้อมูลเพิ่มเติมจากแหล่งข้อมูลอื่นๆ ที่เชื่อถือได้",
        ],
      },
      {
        heading: "7. การติดต่อ",
        body: [
          "หากท่านมีข้อสงสัยหรือข้อเสนอแนะเกี่ยวกับบริการ สามารถติดต่อทีมงานผ่านช่องทางที่ระบุไว้ในเว็บไซต์",
        ],
      },
    ],
    footer:
      "การใช้บริการ Horasard ถือว่าท่านรับทราบและยอมรับข้อจำกัดความรับผิดนี้",
  } satisfies CmsDocument,
  [CMS_KEYS.consentRegister]: {
    text: "ยอมรับนโยบายความเป็นส่วนตัว",
  } satisfies CmsText,
  [CMS_KEYS.consentBirthPrivacy]: {
    text: "ฉันได้อ่านและยอมรับนโยบายความเป็นส่วนตัว",
  } satisfies CmsText,
  [CMS_KEYS.consentBirthEditLimit]: {
    text: "ฉันรับทราบว่าสามารถแก้ไขข้อมูลวันเกิดได้อีก 1 ครั้ง",
  } satisfies CmsText,
  [CMS_KEYS.contact]: {
    email: "support@horasard.com",
    label: "ทีมงาน HoraSard",
  } satisfies CmsContact,
  [CMS_KEYS.maintenanceMode]: {
    enabled: false,
    message: "ระบบอยู่ระหว่างปรับปรุง กรุณากลับมาใหม่ภายหลัง",
  } satisfies CmsMaintenance,
  [CMS_KEYS.paymentInfo]: {
    title: "วิธีชำระเงินเพื่ออัปเกรด Pro",
    bankName: "ธนาคารกสิกรไทย",
    accountName: "บริษัท ตัวอย่าง จำกัด",
    accountNumber: "000-0-00000-0",
    amountNote: "โอนตามราคาแพ็กเกจ Pro ที่แสดงในหน้าบัญชี",
    steps: [
      "โอนเงินตามจำนวนแพ็กเกจ Pro ({price} บาท)",
      "เก็บหลักฐานการโอน (สลิป)",
      "กรอกจำนวนเงินและอัปโหลดสลิปในแบบฟอร์มด้านล่าง",
      "รอแอดมินตรวจสอบ (ปกติภายใน 1–2 วันทำการ)",
    ],
    footer: "หากมีปัญหา ติดต่อทีมงานผ่านอีเมลในแอป",
  } satisfies CmsPaymentInfo,
  [CMS_KEYS.seoHome]: {
    title: "โหราศาสตร์ — ดูดวง AI ออนไลน์",
    description: "ดูดวงและสนทนากับ AI ตามข้อมูลวันเกิดของคุณ",
    ogTitle: "โหราศาสตร์ (HoraSard)",
    ogDescription: "ดูดวง AI ออนไลน์ — สนทนาและทำนายตามดวงชะตา",
  } satisfies CmsSeo,
  [CMS_KEYS.seoPrivacy]: {
    title: "นโยบายความเป็นส่วนตัว — โหราศาสตร์",
    description: "นโยบายความเป็นส่วนตัวและการจัดการข้อมูลส่วนบุคคล",
  } satisfies CmsSeo,
  [CMS_KEYS.seoTerms]: {
    title: "เงื่อนไขการใช้งาน — โหราศาสตร์",
    description: "เงื่อนไขและข้อตกลงในการใช้บริการโหราศาสตร์",
  } satisfies CmsSeo,
  [CMS_KEYS.seoDisclaimer]: {
    title: "ข้อจำกัดความรับผิด — โหราศาสตร์",
    description: "คำทำนายมีไว้เพื่อความบันเทิงและการไตร่ตรองเท่านั้น",
  } satisfies CmsSeo,
  [CMS_KEYS.seoFaq]: {
    title: "คำถามที่พบบ่อย — โหราศาสตร์",
    description: "คำตอบเกี่ยวกับเครดิต แพ็กเกจ Pro การชำระเงิน และการใช้งาน",
  } satisfies CmsSeo,
  [CMS_KEYS.seoPricing]: {
    title: "ราคาแพ็กเกจ — โหราศาสตร์",
    description: "เปรียบเทียบ Free และ Pro ดูดวง AI ตามดวงชะตา",
  } satisfies CmsSeo,
  [CMS_KEYS.seoContact]: {
    title: "ติดต่อเรา — โหราศาสตร์",
    description: "ช่องทางติดต่อทีมงาน HoraSard",
  } satisfies CmsSeo,
  [CMS_KEYS.landingHero]: {
    eyebrow: "AI Horoscope",
    headline: "โหราศาสตร์",
    subheadline:
      "ดูดวงด้วย AI สไตล์แม่หมอ อ่านดวงจากข้อมูลวันเกิดของคุณ อบอุ่น น่าเชื่อถือ และเข้าใจง่าย",
    primaryCta: { text: "เริ่มต้นใช้งาน", href: "/login?tab=register" },
    secondaryCta: { text: "เข้าสู่ระบบ", href: "/login" },
    imageUrl: "",
  } satisfies CmsLandingHero,
  [CMS_KEYS.landingFeatures]: {
    title: "ทำไมต้อง HoraSard",
    subtitle: "ดูดวงที่อ้างอิงพื้นดวงจริง ไม่แต่งดาว",
    items: [
      {
        icon: "✨",
        title: "คำนวณพื้นดวงจริง",
        description: "ใช้สูตรโหรไทยสุริยยาตร์ ลัคนา ทักษา และตำแหน่งดาวจากระบบคำนวณ",
      },
      {
        icon: "💬",
        title: "คุยกับแม่หมอ AI",
        description: "ถามได้หลายรอบต่อเนื่องในหัวข้อที่สนใจ เช่น การงาน ความรัก การเงิน",
      },
      {
        icon: "🔒",
        title: "ข้อมูลส่วนตัวปลอดภัย",
        description: "วันเกิดและบทสนทนาเก็บในบัญชีของคุณ แก้ไขวันเกิดได้จำกัดเพื่อความถูกต้อง",
      },
      {
        icon: "📱",
        title: "ใช้ง่ายทุกอุปกรณ์",
        description: "เปิดจากมือถือหรือคอมพิวเตอร์ — บันทึกประวัติการสนทนาไว้ให้กลับมาอ่าน",
      },
    ],
  } satisfies CmsLandingFeatures,
  [CMS_KEYS.landingHowItWorks]: {
    title: "เริ่มต้นใน 3 ขั้นตอน",
    subtitle: "ไม่กี่นาทีก็ถามดวงได้",
    steps: [
      {
        title: "สมัครสมาชิก",
        description: "สร้างบัญชีด้วยอีเมลหรือ Google — ฟรี",
      },
      {
        title: "กรอกวันเกิด",
        description: "ใส่วัน เวลา และสถานที่เกิด เพื่อคำนวณพื้นดวง",
      },
      {
        title: "ถามดวง",
        description: "เลือกหมวดแล้วถามแม่หมอ AI ได้ทันที (Pro สำหรับแชทเต็มรูปแบบ)",
      },
    ],
  } satisfies CmsLandingHowItWorks,
  [CMS_KEYS.landingPricingSection]: {
    title: "แพ็กเกจที่เหมาะกับคุณ",
    subtitle: "เริ่มฟรีได้ — อัปเกรดเมื่อพร้อมถามดวงเต็มรูปแบบ",
    enabled: true,
  } satisfies CmsLandingPricingSection,
  [CMS_KEYS.landingTestimonials]: {
    title: "เสียงจากผู้ใช้งาน",
    subtitle: "ประสบการณ์จริงจากสมาชิก",
    enabled: true,
    items: [
      {
        name: "นภัส",
        quote: "อ่านง่าย อบอุ่น เหมือนคุยกับแม่หมอจริง ๆ — ช่วยให้คิดเรื่องงานได้ชัดขึ้น",
        stars: 5,
      },
      {
        name: "กิตติ",
        quote: "ชอบที่ระบบอ้างอิงดวงจากวันเกิด ไม่เดา — ใช้งานบนมือถือลื่นดี",
        stars: 5,
      },
      {
        name: "มินตรา",
        quote: "อัปเกรด Pro แล้วถามได้หลายเรื่อง ประวัติคุยเก็บไว้กลับมาอ่านสะดวก",
        stars: 4,
      },
    ],
  } satisfies CmsLandingTestimonials,
  [CMS_KEYS.siteFooter]: {
    brandBlurb:
      "HoraSard — ดูดวง AI ตามหลักโหรไทยสุริยยาตร์ เพื่อความบันเทิงและการไตร่ตรอง",
    copyright: "© HoraSard. สงวนลิขสิทธิ์.",
    links: [
      { label: "ราคา", href: "/pricing" },
      { label: "คำถามที่พบบ่อย", href: "/help" },
      { label: "ติดต่อ", href: "/contact" },
      { label: "นโยบายความเป็นส่วนตัว", href: "/privacy" },
      { label: "เงื่อนไขการใช้งาน", href: "/terms" },
      { label: "ข้อจำกัดความรับผิด", href: "/disclaimer" },
    ],
    socialLinks: [],
  } satisfies CmsSiteFooter,
  [CMS_KEYS.siteTheme]: {
    enabled: false,
    primary: "#c9a24b",
    secondary: "#1f8f7a",
    backgroundDark: "#0d0d0f",
    backgroundLight: "#f3f4f6",
  } satisfies CmsSiteTheme,
};

export const CMS_LABELS: Record<CmsKey, string> = {
  [CMS_KEYS.privacyPolicy]: "นโยบายความเป็นส่วนตัว",
  [CMS_KEYS.termsOfService]: "เงื่อนไขการใช้งาน",
  [CMS_KEYS.disclaimer]: "คำเตือนทำนาย",
  [CMS_KEYS.consentRegister]: "สมัครสมาชิก",
  [CMS_KEYS.consentBirthPrivacy]: "ฟอร์มวันเกิด — ยอมรับนโยบาย",
  [CMS_KEYS.consentBirthEditLimit]: "ฟอร์มวันเกิด — แจ้งแก้ได้ 1 ครั้ง",
  [CMS_KEYS.contact]: "อีเมลติดต่อทีมงาน",
  [CMS_KEYS.maintenanceMode]: "ปิดระบบชั่วคราว",
  [CMS_KEYS.siteTheme]: "สีธีมเว็บ",
  [CMS_KEYS.paymentInfo]: "วิธีโอนเงิน Pro",
  [CMS_KEYS.seoHome]: "SEO — หน้าแรก",
  [CMS_KEYS.seoPrivacy]: "SEO — นโยบาย",
  [CMS_KEYS.seoTerms]: "SEO — เงื่อนไข",
  [CMS_KEYS.seoDisclaimer]: "SEO — คำเตือน",
  [CMS_KEYS.seoFaq]: "SEO — คำถามที่พบบ่อย",
  [CMS_KEYS.seoPricing]: "SEO — ราคา",
  [CMS_KEYS.seoContact]: "SEO — ติดต่อ",
  [CMS_KEYS.landingHero]: "หน้าแรก — Hero",
  [CMS_KEYS.landingFeatures]: "หน้าแรก — จุดเด่น",
  [CMS_KEYS.landingHowItWorks]: "หน้าแรก — วิธีใช้",
  [CMS_KEYS.landingPricingSection]: "หน้าแรก — ส่วนราคา",
  [CMS_KEYS.landingTestimonials]: "หน้าแรก — รีวิว",
  [CMS_KEYS.siteFooter]: "ส่วนท้ายเว็บ (Footer)",
};

/** Sidebar groups for /admin/settings — plain Thai, no jargon. */
export type CmsGroupId =
  | "landing"
  | "legal"
  | "consent"
  | "payment"
  | "system"
  | "seo";

export const CMS_GROUPS: { id: CmsGroupId; label: string; hint: string }[] = [
  { id: "landing", label: "หน้าแรก & การตลาด", hint: "เนื้อหา landing / footer" },
  { id: "legal", label: "หน้านโยบาย", hint: "เอกสารที่ผู้ใช้อ่านได้" },
  { id: "consent", label: "ข้อความยินยอม", hint: "ข้อความใน checkbox" },
  { id: "payment", label: "ชำระเงิน", hint: "ข้อมูลบัญชี & ขั้นตอน" },
  { id: "system", label: "ระบบ", hint: "ตั้งค่าระบบทั่วไป" },
  { id: "seo", label: "SEO & แชร์", hint: "title, description, OG สำหรับ Google/Facebook" },
];

export type CmsMeta = {
  group: CmsGroupId;
  help: string;
  where: string;
  previewPath?: string;
};

export const CMS_META: Record<CmsKey, CmsMeta> = {
  [CMS_KEYS.privacyPolicy]: {
    group: "legal",
    help: "เอกสารนโยบายความเป็นส่วนตัวแบบเต็มหน้า — แก้หัวข้อและรายการได้ตามต้องการ",
    where: "หน้า /privacy · ลิงก์จากฟอร์มสมัครสมาชิก",
    previewPath: "/privacy",
  },
  [CMS_KEYS.termsOfService]: {
    group: "legal",
    help: "เงื่อนไขการใช้บริการ — แยกจากนโยบายความเป็นส่วนตัว",
    where: "หน้า /terms",
    previewPath: "/terms",
  },
  [CMS_KEYS.disclaimer]: {
    group: "legal",
    help: "ข้อจำกัดความรับผิด — ต้องระบุชัดว่าบริการเพื่อความบันเทิงเท่านั้น",
    where: "หน้า /disclaimer",
    previewPath: "/disclaimer",
  },
  [CMS_KEYS.consentRegister]: {
    group: "consent",
    help: "ข้อความข้าง checkbox ตอนสมัครสมาชิก",
    where: "หน้าสมัครสมาชิก /login?tab=register",
    previewPath: "/login?tab=register",
  },
  [CMS_KEYS.consentBirthPrivacy]: {
    group: "consent",
    help: "ข้อความยืนยันว่าผู้ใช้อ่านนโยบายแล้ว ก่อนกรอกวันเกิด",
    where: "ฟอร์มวันเกิด /onboarding",
    previewPath: "/onboarding",
  },
  [CMS_KEYS.consentBirthEditLimit]: {
    group: "consent",
    help: "แจ้งผู้ใช้ว่าแก้วันเกิดได้จำกัดจำนวนครั้ง",
    where: "ฟอร์มวันเกิด /onboarding",
    previewPath: "/onboarding",
  },
  [CMS_KEYS.contact]: {
    group: "system",
    help: "อีเมลที่ผู้ใช้ติดต่อทีมงาน",
    where: "หน้า /contact · หน้านโยบาย",
    previewPath: "/contact",
  },
  [CMS_KEYS.maintenanceMode]: {
    group: "system",
    help: "เปิดเมื่อต้องการปิดแอปชั่วคราว — ผู้ใช้ทั่วไปจะเห็นข้อความ (แอดมินยังเข้าได้)",
    where: "ทุกหน้าในแอป (ยกเว้นแอดมิน)",
  },
  [CMS_KEYS.siteTheme]: {
    group: "system",
    help: "สีแบรนด์ทั้งเว็บ — เปิดใช้แล้วผู้ใช้ทุกคนเห็นสีเดียวกัน (ตั้งง่ายที่ /admin/theme)",
    where: "ทุกหน้าของเว็บ",
    previewPath: "/dashboard",
  },
  [CMS_KEYS.paymentInfo]: {
    group: "payment",
    help: "บัญชีธนาคารและขั้นตอนโอนเงิน",
    where: "หน้าบัญชี /account · หน้าราคา",
    previewPath: "/account",
  },
  [CMS_KEYS.seoHome]: {
    group: "seo",
    help: "Title และ description สำหรับหน้าแรก / แชร์ลิงก์",
    where: "หน้าแรก / · Open Graph",
    previewPath: "/",
  },
  [CMS_KEYS.seoPrivacy]: {
    group: "seo",
    help: "SEO สำหรับหน้านโยบายความเป็นส่วนตัว",
    where: "หน้า /privacy · meta tags",
    previewPath: "/privacy",
  },
  [CMS_KEYS.seoTerms]: {
    group: "seo",
    help: "SEO สำหรับหน้าเงื่อนไขการใช้งาน",
    where: "หน้า /terms · meta tags",
    previewPath: "/terms",
  },
  [CMS_KEYS.seoDisclaimer]: {
    group: "seo",
    help: "SEO สำหรับหน้าคำเตือน",
    where: "หน้า /disclaimer · meta tags",
    previewPath: "/disclaimer",
  },
  [CMS_KEYS.seoFaq]: {
    group: "seo",
    help: "SEO สำหรับหน้าคำถามที่พบบ่อย",
    where: "หน้า /help · meta tags",
    previewPath: "/help",
  },
  [CMS_KEYS.seoPricing]: {
    group: "seo",
    help: "SEO สำหรับหน้าราคา",
    where: "หน้า /pricing · meta tags",
    previewPath: "/pricing",
  },
  [CMS_KEYS.seoContact]: {
    group: "seo",
    help: "SEO สำหรับหน้าติดต่อ",
    where: "หน้า /contact · meta tags",
    previewPath: "/contact",
  },
  [CMS_KEYS.landingHero]: {
    group: "landing",
    help: "หัวข้อหลักและปุ่ม CTA บนหน้าแรก",
    where: "หน้าแรก /",
    previewPath: "/",
  },
  [CMS_KEYS.landingFeatures]: {
    group: "landing",
    help: "การ์ดจุดเด่น — เพิ่ม/ลบ/เรียงได้",
    where: "หน้าแรก /",
    previewPath: "/",
  },
  [CMS_KEYS.landingHowItWorks]: {
    group: "landing",
    help: "ขั้นตอนสมัคร → กรอกวันเกิด → ถามดวง",
    where: "หน้าแรก /",
    previewPath: "/",
  },
  [CMS_KEYS.landingPricingSection]: {
    group: "landing",
    help: "หัวข้อส่วนราคา (ราคาจริงดึงจากแพ็กเกจในระบบ)",
    where: "หน้าแรก / · /pricing",
    previewPath: "/",
  },
  [CMS_KEYS.landingTestimonials]: {
    group: "landing",
    help: "รีวิวผู้ใช้ — ปิดทั้ง section ได้",
    where: "หน้าแรก /",
    previewPath: "/",
  },
  [CMS_KEYS.siteFooter]: {
    group: "landing",
    help: "ส่วนท้ายทุกหน้าสาธารณะ — ลิงก์และข้อความลิขสิทธิ์",
    where: "ทุกหน้า public",
    previewPath: "/",
  },
};

export function cmsKeysInGroup(group: CmsGroupId): CmsKey[] {
  return (Object.values(CMS_KEYS) as CmsKey[]).filter(
    (key) => CMS_META[key].group === group,
  );
}

/** Keys edited primarily on /admin/landing. */
export const LANDING_CMS_KEYS: CmsKey[] = [
  CMS_KEYS.landingHero,
  CMS_KEYS.landingFeatures,
  CMS_KEYS.landingHowItWorks,
  CMS_KEYS.landingPricingSection,
  CMS_KEYS.landingTestimonials,
  CMS_KEYS.siteFooter,
];
