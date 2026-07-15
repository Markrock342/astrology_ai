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

/** Max prior user+assistant pairs sent to the model (older turns are trimmed). */
export const MAX_CONVERSATION_TURNS = 4;

/** Max thread rows loaded from DB for prompt context (slightly above trimmed history). */
export const MAX_PRIOR_MESSAGES_LOAD = MAX_CONVERSATION_TURNS * 3;

/** Assistant replies in history are truncated to this many chars to save input tokens. */
export const HISTORY_ASSISTANT_MAX_CHARS = 600;

/**
 * Total character budget for knowledge docs in the system prompt.
 * Raised from 4,000: docs past the budget were silently dropped, so a rich
 * knowledge base got truncated to a few entries and the answers read shallow.
 * ~6,000 chars ≈ 2,000 input tokens — cheap to process, and the difference
 * between a generic reply and one that cites the tradition.
 */
export const KNOWLEDGE_MAX_CHARS = 6_000;

/**
 * Plan-specific output caps (applied on top of Admin AIProviderConfig).
 *
 * These bound GENERATION TIME, which is the wait users actually feel: the model
 * emits ~40–60 tokens/sec, so 2,048 tokens is ~40s of typing. A horoscope answer
 * does not need 700 words — 1,536 (~520 Thai words) stays complete and thorough
 * while shaving a quarter off the wait. The client streams it, so the reader is
 * reading from the second token, not staring at a blank bubble.
 */
export const FREE_MAX_OUTPUT_TOKENS = 1_024;
export const PRO_MAX_OUTPUT_TOKENS = 1_536;

/**
 * UX Wave F — brief answer mode caps.
 *
 * The cap is a runaway guard, NOT the brevity lever — BRIEF_ANSWER_HINT is.
 * Billing is per token actually generated, so a tight cap saves nothing; all it
 * can do is truncate.
 *
 * And on Gemini 3 it does worse than truncate: thinking tokens are drawn from
 * the SAME maxOutputTokens budget. At 640/768 the model could spend the whole
 * allowance reasoning and emit no answer at all — brief mode returned an empty
 * bubble. The cap must therefore leave room for thinking PLUS the ~150 words
 * the hint asks for (Thai runs ~3–4 tokens/word).
 */
export const BRIEF_MAX_OUTPUT_TOKENS_FREE = 1_024;
export const BRIEF_MAX_OUTPUT_TOKENS_PRO = 1_280;

export const BRIEF_ANSWER_HINT =
  "โหมดกระชับ (สำคัญ ทับทุกกติกาก่อนหน้า): ตอบเป็นร้อยแก้ว 2–3 ย่อหน้าสั้น รวมไม่เกิน 150 คำ " +
  "ห้ามใช้ตาราง ห้ามใช้หัวข้อ ห้ามใช้ bullet — โครงสร้างพวกนั้นกินโควตาคำตอบจนโดนตัดกลางประโยค " +
  "ปิดท้ายด้วยประโยคชวนถามต่อสั้น ๆ ได้หนึ่งประโยค";
