/**
 * Gemini model IDs — editable from Admin → โมเดล AI.
 * Google retired 2.5 / 2.0 flash in mid-2026; 3.1 Flash Lite is superseded by 3.5 Lite.
 * Gemini 3.6 Flash is superseded by 3.7 Flash (Aug 2026).
 */

/** Detailed / Pro default. */
export const DEFAULT_GEMINI_MODEL_ID = "gemini-3.7-flash";

/** Brief (กระชับ) default — not lite. */
export const DEFAULT_GEMINI_BRIEF_MODEL_ID = "gemini-3.5-flash";

/** Cheapest fallback when the brief/detailed model fails. */
export const DEFAULT_GEMINI_LITE_MODEL_ID = "gemini-3.5-flash-lite";

/** Quick-pick options in Admin CMS. */
export const GEMINI_MODEL_PRESETS: { id: string; label: string }[] = [
  { id: DEFAULT_GEMINI_LITE_MODEL_ID, label: "3.5 Flash Lite — ถูกสุด (fallback)" },
  { id: DEFAULT_GEMINI_BRIEF_MODEL_ID, label: "3.5 Flash — กระชับ" },
  { id: DEFAULT_GEMINI_MODEL_ID, label: "3.7 Flash — ละเอียด (แนะนำ)" },
];

/** Old IDs Google removed or superseded — show admin a nudge to migrate. */
export const GEMINI_DEPRECATED_MODELS: Record<string, string> = {
  "gemini-2.5-flash": DEFAULT_GEMINI_MODEL_ID,
  "gemini-2.5-flash-lite": DEFAULT_GEMINI_LITE_MODEL_ID,
  "gemini-2.0-flash": DEFAULT_GEMINI_LITE_MODEL_ID,
  "gemini-2.0-flash-lite": DEFAULT_GEMINI_LITE_MODEL_ID,
  "gemini-3.1-flash-lite": DEFAULT_GEMINI_LITE_MODEL_ID,
  "gemini-3.6-flash": DEFAULT_GEMINI_MODEL_ID,
};

export function geminiReplacementHint(modelId: string): string | null {
  const next = GEMINI_DEPRECATED_MODELS[modelId.trim().toLowerCase()];
  return next ? `โมเดลนี้ถูกยกเลิกแล้ว — เปลี่ยนเป็น ${next}` : null;
}

function normalizeModelId(modelId: string | null | undefined): string {
  return (modelId ?? "").trim().toLowerCase();
}

/** กระชับ: 3.5 Flash or any *lite* model. */
export function isBriefGeminiModel(modelId: string): boolean {
  const id = normalizeModelId(modelId);
  return id.includes("lite") || id === DEFAULT_GEMINI_BRIEF_MODEL_ID;
}

/** ละเอียด: 3.7 / 3.6 Flash (not lite). */
export function isDetailedGeminiModel(modelId: string): boolean {
  const id = normalizeModelId(modelId);
  return id.includes("3.7-flash") || id.includes("3.6-flash");
}

/** Higher is preferred among brief candidates (3.5 Flash over lite). */
export function briefGeminiRank(modelId: string): number {
  const id = normalizeModelId(modelId);
  if (id === DEFAULT_GEMINI_BRIEF_MODEL_ID) return 2;
  if (id.includes("lite")) return 1;
  return 0;
}

/** Higher is preferred among detailed candidates (3.7 over 3.6). */
export function detailedGeminiRank(modelId: string): number {
  const id = normalizeModelId(modelId);
  if (id.includes("3.7-flash")) return 2;
  if (id.includes("3.6-flash")) return 1;
  return 0;
}

/**
 * Gemini 3.7 Flash does not support thinkingLevel MINIMAL (API error → fallback
 * to the cheap model). Use LOW, the fastest level it accepts.
 */
export function gemini3ThinkingLevel(modelId: string): "MINIMAL" | "LOW" {
  return normalizeModelId(modelId).includes("3.7") ? "LOW" : "MINIMAL";
}
