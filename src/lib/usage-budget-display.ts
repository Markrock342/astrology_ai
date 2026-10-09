import { DEFAULT_GEMINI_MODEL_ID } from "@/config/gemini-models";
import { estimateCostUsd, USD_TO_THB } from "@/config/ai-pricing";

/**
 * Package budgets in words people use. The admin form asked for "หน่วย
 * ภายใน" (1,000,000 = 1 USD) and nobody could say what 27,778 meant; it now
 * reads in questions and baht, and the units are worked out from those.
 *
 * A typical question: about 16,000 tokens in (chart, rules, knowledge) and
 * 900 out (answer + thinking) on the default chat model — measured on
 * 5 Oct 2026. The count is an estimate; a long reading costs more.
 */
/** Same as USAGE_UNITS_PER_USD in usage-budget-service (server-only file). */
const USAGE_UNITS_PER_USD = 1_000_000;
const TYPICAL_INPUT_TOKENS = 16_000;
const TYPICAL_OUTPUT_TOKENS = 900;

export function typicalQuestionThb(modelId: string = DEFAULT_GEMINI_MODEL_ID): number {
  return estimateCostUsd(modelId, TYPICAL_INPUT_TOKENS, TYPICAL_OUTPUT_TOKENS) * USD_TO_THB;
}

export function unitsToThb(units: number): number {
  return (units / USAGE_UNITS_PER_USD) * USD_TO_THB;
}

export function thbToUnits(thb: number): number {
  return Math.max(0, Math.round((thb / USD_TO_THB) * USAGE_UNITS_PER_USD));
}

/**
 * One question, in wallet units. Since 9 Oct 2026 every answer costs exactly
 * one question whatever its length (A: "เรารับความเสี่ยงเรื่องความยาวของคำถาม"),
 * so packs are sold — and wallets read — in whole questions. 15,000 units is
 * the measured typical question (฿0.55 at 3.7 Flash), so balances from before
 * read about the same. The AI's real cost is still logged per call.
 */
export const UNITS_PER_QUESTION = 15_000;

/**
 * Questions a balance buys. Rounded up: an older balance that is not a whole
 * number of questions still answers its last one (the charge takes what is left).
 */
export function unitsToQuestions(units: number): number {
  return units > 0 ? Math.ceil(units / UNITS_PER_QUESTION) : 0;
}

export function questionsToUnits(questions: number): number {
  return Math.max(0, Math.round(questions)) * UNITS_PER_QUESTION;
}

/**
 * The chat's "เหลือ …%" chip. 100% is the package allowance; add-on packs can
 * push it far past that, and "เหลือ 1387.9%" told the reader nothing.
 */
export function formatRemainingChip(percent: number): string {
  if (percent > 100) return "100%+";
  return `${Math.max(0, Math.round(percent))}%`;
}

/**
 * The usage chip, in questions when the server sent an estimate: users read
 * "เหลือ 37%" as "37 questions?" or nothing at all.
 */
export function formatRemainingUsage(percent: number, questions?: number | null): string {
  if (typeof questions === "number" && Number.isFinite(questions)) {
    return questions <= 0 ? "หมดแล้ว" : `${questions.toLocaleString("th-TH")} คำถาม`;
  }
  return formatRemainingChip(percent);
}
