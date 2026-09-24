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

/** Max prior user+assistant pairs available to the model. */
export const MAX_CONVERSATION_TURNS = 10;

/** Max thread rows loaded from DB for prompt context (slightly above trimmed history). */
export const MAX_PRIOR_MESSAGES_LOAD = MAX_CONVERSATION_TURNS * 3;

/** Assistant replies in history are truncated to this many chars to save input tokens. */
export const HISTORY_ASSISTANT_MAX_CHARS = 1_200;

/** Character ceiling across prior chat turns so longer memory stays affordable. */
export const CONVERSATION_HISTORY_MAX_CHARS = 16_000;

/**
 * Total character budget for knowledge chunks selected by the RAG retriever.
 * The whole enabled corpus remains searchable; only the best matching chunks
 * for the question, recent turns, category and chart facts enter the prompt.
 */
export const KNOWLEDGE_MAX_CHARS = 28_000;

/**
 * Free trial depth as a percentage of the Pro reading (single knob).
 *
 * Free is a trial, not a Pro clone: it must show the product works without
 * giving away the full reading. This one number drives the Free knowledge
 * budget (fewer doctrine chunks), the Free visible-length hint and the plan
 * instruction that limits how many chart signals the model expands on.
 * Output-token caps stay separate — they exist for Gemini thinking headroom,
 * not for depth (see FREE_MAX_OUTPUT_TOKENS).
 */
export const FREE_TRIAL_DEPTH_PERCENT = 60;

function scaleForTrial(value: number, roundTo = 10): number {
  return Math.round((value * FREE_TRIAL_DEPTH_PERCENT) / 100 / roundTo) * roundTo;
}

/** Free gets the best-ranked chunks only, inside this smaller budget. */
export const FREE_KNOWLEDGE_MAX_CHARS = scaleForTrial(KNOWLEDGE_MAX_CHARS, 100);

/** Pro detailed visible length (words) — Free is derived from this. */
/**
 * Length target for a detailed single-topic answer. It was 350–500, set when
 * answers leaned on headings and tables; once the team's method asked for one
 * continuous story per topic, the same budget read as four thin paragraphs.
 */
export const PRO_DETAILED_WORDS_MIN = 800;
export const PRO_DETAILED_WORDS_MAX = 1_100;
/** Per topic, for a 17-topic overview. */
export const PRO_OVERVIEW_WORDS_PER_TOPIC_MIN = 150;
export const PRO_OVERVIEW_WORDS_PER_TOPIC_MAX = 220;
export const FREE_DETAILED_WORDS_MIN = scaleForTrial(PRO_DETAILED_WORDS_MIN);
export const FREE_DETAILED_WORDS_MAX = scaleForTrial(PRO_DETAILED_WORDS_MAX);
export const FREE_OVERVIEW_WORDS_PER_TOPIC_MIN = scaleForTrial(PRO_OVERVIEW_WORDS_PER_TOPIC_MIN);
export const FREE_OVERVIEW_WORDS_PER_TOPIC_MAX = scaleForTrial(PRO_OVERVIEW_WORDS_PER_TOPIC_MAX);

/** Plan block of the system prompt (spec 7.2 slot 3). */
export const PLAN_HINT_PRO =
  "ผู้ใช้ระดับ Pro: อ่านให้ครบทุกสัญญาณที่เกี่ยวกับคำถาม (ลัคนา เจ้าเรือน มุมจาก [aspects] ทักษา และดวงจร) " +
  "ตอบครบถ้วนตรงคำถาม ใช้หัวข้อ/ตารางเมื่อมีหลายจุด — ไม่เกริ่นยาว ไม่ซ้ำประเด็น";

export const PLAN_HINT_FREE =
  `ผู้ใช้ระดับ Free (แพ็กเกจทดลอง): ให้คำอ่านลึกประมาณ ${FREE_TRIAL_DEPTH_PERCENT}% ของระดับ Pro — ` +
  "หยิบสัญญาณเด่นที่เกี่ยวกับคำถามมากที่สุดเพียง 1–2 อย่างมาอธิบาย ห้ามไล่เจ้าเรือนครบทุกเรือน " +
  "ห้ามทำตารางดาว/มุม/จังหวะครบชุด ห้ามแจกแจงดวงจรทีละเดือนเกินช่วงที่ถาม " +
  "สิ่งที่อ่านต้องถูกต้องและตอบคำถามจริง ไม่ใช่ตอบครึ่ง ๆ กลาง ๆ " +
  "ปิดท้ายได้เพียงหนึ่งประโยคสั้น ๆ ว่ามุมที่ยังไม่ได้ลง (เช่น มุมสัมพันธ์ครบชุดหรือจังหวะรายเดือน) จะอ่านให้เต็มในระดับ Pro " +
  "โดยไม่หลุดบุคลิกและไม่พูดซ้ำหลายครั้ง";

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
export const FREE_MAX_OUTPUT_TOKENS = 4_096;
export const PRO_MAX_OUTPUT_TOKENS = 6_144;
/** A 17-topic overview in prose (see READING_METHOD_RULE). */
export const PRO_OVERVIEW_MAX_OUTPUT_TOKENS = 12_288;
export const FREE_OVERVIEW_MAX_OUTPUT_TOKENS = 6_144;

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

/**
 * How a detailed single-topic answer is laid out. Depth comes from the story,
 * not from padding: the topic is split into a few ## sections, each prose,
 * and one summary table closes it — the table the team missed. It stays
 * outside the narrative, which is where the reading method forbids lists.
 */
const DETAILED_SINGLE_TOPIC_SHAPE =
  "แบ่งหัวข้อที่ถามเป็น 3–5 ส่วนด้วย ## เช่น ภาพรวมจากพื้นดวง · ตามดาวเจ้าเรือนไปดู · ดาวร่วมเรือน มุม และดาวคู่ · " +
  "ทักษาเดิม (และจังหวะดวงจรกับทักษาจรถ้าถามเรื่องเวลา) · ข้อแนะนำที่ทำได้จริง " +
  "แต่ละส่วนเป็นความเรียงหลายย่อหน้า ห้ามข้อย่อยในเนื้อหา " +
  "ปิดท้ายด้วยตารางสรุปหนึ่งตาราง ชื่อ ### ดาวที่เกี่ยวข้องกับเรื่องนี้ คอลัมน์ ดาว | ราศี · ภพ | มาตรฐาน | ทักษา | บทบาทในเรื่องนี้ " +
  "ใช้ข้อมูลจาก [planet_facts] เท่านั้น แล้วจบด้วยคำถามชวนคุยต่อหนึ่งประโยคที่เจาะคำถามเดิม";

/** Free detailed — the same shape, shorter (trial depth). */
export const DETAILED_ANSWER_HINT_FREE =
  `โหมดละเอียด (แพ็กเกจทดลอง): เขียนลึก อ่านลื่น รวมประมาณ ${FREE_DETAILED_WORDS_MIN}–${FREE_DETAILED_WORDS_MAX} คำ ไม่นับตาราง ` +
  DETAILED_SINGLE_TOPIC_SHAPE +
  " ห้ามยืดยาวซ้ำซ้อน ห้ามตัดท้ายกลางประโยค";

/** Pro detailed — keep the visible answer complete without filling the token cap. */
export const DETAILED_ANSWER_HINT_PRO =
  `โหมดละเอียด: เขียนลึก อ่านลื่น รวมประมาณ ${PRO_DETAILED_WORDS_MIN}–${PRO_DETAILED_WORDS_MAX} คำ ไม่นับตาราง ` +
  DETAILED_SINGLE_TOPIC_SHAPE +
  " ห้ามยืดยาวซ้ำซ้อน ห้ามตัดท้ายกลางประโยค — ถ้าใกล้จบให้สรุปสั้นแล้วปิด";

/**
 * An overview walks all 17 topics. It used to get the single-topic hint,
 * whose 350–500-word total left each topic about thirty words.
 */
export const OVERVIEW_ANSWER_HINT_PRO =
  `โหมดละเอียด ดูดวงภาพรวม: ไล่ครบ 17 หัวข้อ หัวข้อละประมาณ ${PRO_OVERVIEW_WORDS_PER_TOPIC_MIN}–${PRO_OVERVIEW_WORDS_PER_TOPIC_MAX} คำ ` +
  "แต่ละหัวข้อเป็น ## ตามด้วยความเรียง ห้ามข้อย่อย " +
  "ปิดท้ายด้วยตารางสรุปหนึ่งตาราง ชื่อ ### ภาพรวมดาวในดวง คอลัมน์ ดาว | ราศี · ภพ | มาตรฐาน | ทักษา จาก [planet_facts] " +
  "แล้วข้อคิดเชิงบวก 1–2 ประโยค ห้ามตัดท้ายกลางประโยค";

export const OVERVIEW_ANSWER_HINT_FREE =
  `โหมดละเอียด ดูดวงภาพรวม (แพ็กเกจทดลอง): ไล่ครบ 17 หัวข้อ หัวข้อละประมาณ ${FREE_OVERVIEW_WORDS_PER_TOPIC_MIN}–${FREE_OVERVIEW_WORDS_PER_TOPIC_MAX} คำ ` +
  "แต่ละหัวข้อเป็น ## ตามด้วยความเรียง ห้ามข้อย่อย " +
  "ปิดท้ายด้วยตารางสรุปหนึ่งตาราง จาก [planet_facts] แล้วข้อคิดเชิงบวก 1–2 ประโยค ห้ามตัดท้ายกลางประโยค";

/** Delete private slip blobs this many days after admin review (PDPA retention). */
export const SLIP_RETENTION_DAYS = 90;

/** Customer-facing SLA: pending slip older than this is "overdue". */
export const PAYMENT_PENDING_SLA_HOURS = 48;

/** Warn Pro members this many days before subscription expiresAt. */
export const PRO_EXPIRY_WARN_DAYS = 7;

/** Admin TOTP step-up cookie lifetime. */
export const ADMIN_2FA_TTL_MS = 12 * 60 * 60 * 1000;
