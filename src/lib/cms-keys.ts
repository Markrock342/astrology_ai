/**
 * CMS content keys stored in `app_settings`. Admin edits these in /admin/settings;
 * public pages read via settings-service (never hardcode legal copy in components).
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

export const CMS_KEYS = {
  privacyPolicy: "privacy_policy",
  termsOfService: "terms_of_service",
  disclaimer: "disclaimer",
  consentRegister: "consent_register",
  consentBirthPrivacy: "consent_birth_privacy",
  consentBirthEditLimit: "consent_birth_edit_limit",
  contact: "contact",
  maintenanceMode: "maintenance_mode",
  paymentInfo: "payment_info",
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
    title: "เงื่อนไขการใช้งาน",
    lastUpdated: "4 กรกฎาคม 2568",
    intro: "การใช้บริการโหราศาสตร์ (HoraSard) ถือว่าคุณยอมรับเงื่อนไขต่อไปนี้",
    sections: [
      {
        heading: "1. การใช้บริการ",
        body: [
          "บริการมีไว้เพื่อความบันเทิงและการไตร่ตรองส่วนบุคคล",
          "ผู้ใช้ต้องให้ข้อมูลวันเกิดที่ถูกต้องและเป็นของตนเอง",
        ],
      },
      {
        heading: "2. บัญชีและความปลอดภัย",
        body: [
          "คุณรับผิดชอบการรักษาความลับของรหัสผ่าน",
          "ห้ามใช้บริการในทางที่ผิดกฎหมายหรือรบกวนผู้อื่น",
        ],
      },
    ],
  } satisfies CmsDocument,
  [CMS_KEYS.disclaimer]: {
    text: "คำทำนายมีวัตถุประสงค์เพื่อความบันเทิงและการไตร่ตรองเท่านั้น ไม่ใช่คำแนะนำทางการแพทย์ การเงิน หรือกฎหมาย",
  } satisfies CmsText,
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
      "โอนเงินตามจำนวนแพ็กเกจ Pro",
      "เก็บหลักฐานการโอน (สลิป)",
      "กรอกแบบฟอร์มแจ้งชำระเงินด้านล่าง พร้อมเลขอ้างอิง/หมายเหตุ",
      "รอแอดมินตรวจสอบ (ภายใน 1–2 วันทำการ)",
    ],
    footer: "หากมีปัญหา ติดต่อทีมงานผ่านอีเมลในแอป",
  } satisfies CmsPaymentInfo,
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
  [CMS_KEYS.paymentInfo]: "วิธีโอนเงิน Pro",
};

/** Sidebar groups for /admin/settings — plain Thai, no jargon. */
export type CmsGroupId = "legal" | "consent" | "payment" | "system";

export const CMS_GROUPS: { id: CmsGroupId; label: string; hint: string }[] = [
  { id: "legal", label: "หน้านโยบาย", hint: "เอกสารที่ผู้ใช้อ่านได้" },
  { id: "consent", label: "ข้อความยินยอม", hint: "ข้อความใน checkbox" },
  { id: "payment", label: "ชำระเงิน", hint: "ข้อมูลบัญชี & ขั้นตอน" },
  { id: "system", label: "ระบบ", hint: "ตั้งค่าระบบทั่วไป" },
];

export type CmsMeta = {
  group: CmsGroupId;
  /** One-line explanation shown in the editor. */
  help: string;
  /** Where users will see this content. */
  where: string;
  /** Public page to preview (opens in new tab). */
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
    help: "ข้อความสั้น ๆ ว่าคำทำนายมีไว้เพื่อความบันเทิง ไม่ใช่คำแนะนำทางการแพทย์หรือการเงิน",
    where: "หน้า /disclaimer",
    previewPath: "/disclaimer",
  },
  [CMS_KEYS.consentRegister]: {
    group: "consent",
    help: "ข้อความข้าง checkbox ตอนสมัครสมาชิก — มักเขียนว่า “ยอมรับนโยบายความเป็นส่วนตัว”",
    where: "หน้าสมัครสมาชิก /register",
    previewPath: "/register",
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
    help: "อีเมลที่ผู้ใช้ติดต่อทีมงาน — แสดงในหน้านโยบายและข้อความช่วยเหลือ",
    where: "หน้านโยบาย · ข้อความในแอป",
  },
  [CMS_KEYS.maintenanceMode]: {
    group: "system",
    help: "เปิดเมื่อต้องการปิดแอปชั่วคราว — ผู้ใช้ทั่วไปจะเห็นข้อความด้านล่าง (แอดมินยังเข้าได้)",
    where: "ทุกหน้าในแอป (ยกเว้นแอดมิน)",
  },
  [CMS_KEYS.paymentInfo]: {
    group: "payment",
    help: "บัญชีธนาคารและขั้นตอนโอนเงิน — ผู้ใช้เห็นในหน้าบัญชีก่อนแจ้งชำระ",
    where: "หน้าบัญชี /account",
    previewPath: "/account",
  },
};

export function cmsKeysInGroup(group: CmsGroupId): CmsKey[] {
  return (Object.values(CMS_KEYS) as CmsKey[]).filter(
    (key) => CMS_META[key].group === group,
  );
}
