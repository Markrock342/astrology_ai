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

/** Max prior user+assistant pairs sent to the model (older turns are trimmed). */
export const MAX_CONVERSATION_TURNS = 4;

/** Max thread rows loaded from DB for prompt context (slightly above trimmed history). */
export const MAX_PRIOR_MESSAGES_LOAD = MAX_CONVERSATION_TURNS * 3;

/** Assistant replies in history are truncated to this many chars to save input tokens. */
export const HISTORY_ASSISTANT_MAX_CHARS = 600;

/**
 * Total character budget for knowledge docs in the system prompt.
 * Sized for the myhora-style doctrine set (foundation + planets + houses +
 * taksa/transits + signs) plus one category guide (~20–24k Thai chars).
 * Docs past the budget are dropped by sortOrder — put critical doctrine first.
 */
export const KNOWLEDGE_MAX_CHARS = 28_000;

/**
 * Plan-specific output caps (applied on top of Admin AIProviderConfig).
 *
 * Gemini 3.x draws *thinking* from this same budget and does not count it in
 * candidatesTokenCount. 3.7 Flash cannot use MINIMAL thinking (LOW is the
 * floor), so a 1,536 cap routinely spends the whole allowance on reasoning and
 * cuts the Thai answer mid-sentence. These numbers leave room for LOW thinking
 * PLUS the visible length the DETAILED_ANSWER_HINT asks for. Visible length is
 * still the hint — not this ceiling.
 */
export const FREE_MAX_OUTPUT_TOKENS = 2_048;
export const PRO_MAX_OUTPUT_TOKENS = 4_096;

/**
 * First visible token wait for ละเอียด / Gemini 3.7. Thinking-only SSE frames
 * do not reset the idle timer, so the first real character must arrive within
 * this window or the stream aborts as a timeout.
 */
export const GEMINI_DETAILED_FIRST_TOKEN_MS = 90_000;

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
 *
 * These stay below the detailed plan caps (brief < detailed by design). Brief
 * mode now routes to Gemini 3.5 Flash whose MINIMAL thinking is small, so
 * these leave enough room; if a complex chart ever starves brief on Gemini 3,
 * raise the fallback retry's cap rather than pushing brief above detailed.
 */
export const BRIEF_MAX_OUTPUT_TOKENS_FREE = 896;
export const BRIEF_MAX_OUTPUT_TOKENS_PRO = 1_280;

export const BRIEF_ANSWER_HINT =
  "โหมดกระชับ (สำคัญ ทับกติการูปแบบก่อนหน้า): ตอบคำถามให้จบใน 2–3 ย่อหน้าสั้น รวมไม่เกิน 180 คำ " +
  "ห้ามใช้ตาราง ห้ามใช้หัวข้อ ห้ามใช้ bullet — โครงสร้างพวกนั้นกินโควตาคำตอบจนโดนตัดกลางประโยค " +
  "ถ้าถามช่วงเวลา ให้ระบุเดือนจาก [transit] ก่อน แล้วค่อยอธิบายสั้น ๆ " +
  "ห้ามปิดท้ายด้วยคำถามคนละเรื่อง ถ้าจะชวนต่อได้เพียงประโยคที่เจาะคำถามเดิมให้ชัดขึ้น";

/** Free detailed — still capped so trial credits don't burn on 700-word essays. */
export const DETAILED_ANSWER_HINT_FREE =
  "โหมดละเอียด (แพ็กเกจทดลอง): ตอบชัด อ่านง่าย รวมประมาณ 250–350 คำ " +
  "หัวข้อย่อยใช้ได้เฉพาะเมื่อคำถามมีหลายส่วน ห้ามตั้งหัวข้อเป็นหมวดชีวิต " +
  "ห้ามยืดยาวซ้ำซ้อน ห้ามตารางยาว " +
  "ปิดท้ายด้วยคำถามชวนคุยต่อหนึ่งประโยคที่เจาะคำถามเดิม";

/** Pro detailed — keep the visible answer complete without filling the token cap. */
export const DETAILED_ANSWER_HINT_PRO =
  "โหมดละเอียด: ตอบชัด อ่านง่าย รวมประมาณ 350–500 คำ " +
  "หัวข้อย่อยใช้ได้เฉพาะเมื่อคำถามมีหลายส่วน ห้ามตั้งหัวข้อเป็นหมวดชีวิต " +
  "ห้ามยืดยาวซ้ำซ้อน ห้ามตารางยาว " +
  "ห้ามตัดท้ายกลางประโยค — ถ้าใกล้จบให้สรุปสั้นแล้วปิดด้วยคำถามชวนคุยต่อหนึ่งประโยคที่เจาะคำถามเดิม";

/** Delete private slip blobs this many days after admin review (PDPA retention). */
export const SLIP_RETENTION_DAYS = 90;

/** Customer-facing SLA: pending slip older than this is "overdue". */
export const PAYMENT_PENDING_SLA_HOURS = 48;

/** Warn Pro members this many days before subscription expiresAt. */
export const PRO_EXPIRY_WARN_DAYS = 7;

/** Admin TOTP step-up cookie lifetime. */
export const ADMIN_2FA_TTL_MS = 12 * 60 * 60 * 1000;
