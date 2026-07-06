/**
 * App-wide constants and configurable defaults.
 * Business rules that are still unconfirmed (see README "Open Questions") are
 * kept here as editable defaults instead of being hard-coded across the app.
 */

import {
  DEFAULT_GEMINI_LITE_MODEL_ID,
  DEFAULT_GEMINI_MODEL_ID,
} from "@/config/gemini-models";

export const APP_NAME = "HoraSard";
export const APP_NAME_TH = "โหราศาสตร์";
/** Client PSD wordmark (lowercase latin). Rendered as artwork: public/wordmark.png */
export const APP_WORDMARK = "horasard";
/** Primary tagline under the wordmark (Website_Design.psd). */
export const APP_TAGLINE_TH = "ดูดวงตามหลักโหราศาสตร์ไทย ระบบสุริยยาตร์";
/** Secondary sub-tagline (Website_Design.psd). */
export const APP_TAGLINE_SUB_TH =
  "ปลอดภัย ใช้แค่ วัน เดือน ปี เวลา และ สถานที่เกิด ไม่ต้องใช้ข้อมูลอื่น";

/** Default seed values — override via Admin CMS once client confirms. */
export const DEFAULTS = {
  freeCreditQuota: 3,
  proCreditQuota: 100,
  proPriceThb: 199,
  creditCostPerReading: 1,
  aiTimeoutMs: 30_000,
  temperature: 0.7,
  maxOutputTokens: 2048,
  // Editable via Admin → โมเดล AI. Google retired 2.5 Flash mid-2026.
  defaultGeminiModelId: DEFAULT_GEMINI_MODEL_ID,
  defaultGeminiLiteModelId: DEFAULT_GEMINI_LITE_MODEL_ID,
} as const;

/** Timezone for display. Storage is always UTC (business rule 13). */
export const DISPLAY_TIMEZONE = "Asia/Bangkok";

export const CREDIT_SECRET_ENV = "GEMINI_API_KEY";
