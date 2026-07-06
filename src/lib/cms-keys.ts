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
  [CMS_KEYS.disclaimer]: "ข้อจำกัดความรับผิด (Disclaimer)",
  [CMS_KEYS.consentRegister]: "ข้อความยินยอม — สมัครสมาชิก",
  [CMS_KEYS.consentBirthPrivacy]: "ข้อความยินยอม — ฟอร์มวันเกิด (นโยบาย)",
  [CMS_KEYS.consentBirthEditLimit]: "ข้อความยินยอม — ฟอร์มวันเกิด (แก้ได้ 1 ครั้ง)",
  [CMS_KEYS.contact]: "ข้อมูลติดต่อ",
  [CMS_KEYS.maintenanceMode]: "โหมดปิดปรับปรุงระบบ",
  [CMS_KEYS.paymentInfo]: "คำแนะนำชำระเงิน (Manual)",
};
