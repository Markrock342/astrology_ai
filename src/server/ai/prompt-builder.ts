import type { BirthProfileSnapshot, ConversationTurn } from "@/types";
import type { ChartJson } from "@/types/chart";
import type { UserChartMemoryJson } from "@/types/chart-memory";
import {
  HISTORY_ASSISTANT_MAX_CHARS,
  MAX_CONVERSATION_TURNS,
} from "@/config/constants";
import { AppError } from "@/lib/errors";
import { assertUsableEngineChart } from "@/server/horoscope/chart-context";
import {
  formatChartCompactForPrompt,
  formatChartForPrompt,
} from "@/server/horoscope/engine/format-chart-prompt";
import { formatMemoryForPrompt } from "@/server/horoscope/engine/derive-chart-memory";

/**
 * Composes the final prompt in the order defined by spec 7.2:
 *   1. Global safety   2. Brand/persona   3. Plan   4. Category
 *   5. Basic knowledge 6. Birth profile   7. User question   8. Output format
 *
 * Engine-first: natal (and optional transit) chart blocks are required context.
 */
export type PromptParts = {
  safety: string;
  persona: string;
  plan: string;
  category: string;
  knowledge?: string;
  outputFormat: string;
};

/** Hard rule injected into every system prompt (engine-first). */
export const ENGINE_CHART_RULE =
  "กฎบังคับ: คำตอบทุกครั้งต้องอ้างจากตาราง [natal] และ [memory] (และ [transit] ถ้ามี) ในข้อความผู้ใช้ " +
  "ใช้เฉพาะตำแหน่งดาว ลัคนา ทักษา และตารางจากบล็อกนั้นเท่านั้น " +
  "ห้ามแต่ง ห้ามเดา ห้ามสมมติตำแหน่งดาวหรือราศีเอง " +
  "ทบทวนตารางก่อนตอบ: ดาวอยู่ราศี/เรือนใด มาตรฐาน (อุจจ์/นีจ/สวักษ์) สัมพันธ์ดาวเป็นอย่างไร " +
  "ตอบคำถามผู้ใช้ตรง ๆ — ห้ามพิมพ์อธิบายว่า 'นี่คือพื้นดวง' 'ระบบคำนวณให้' หรือสอนว่ากราฟคืออะไร " +
  "ห้ามบอกว่า engine / ระบบคำนวณ / ดวงจร ยังอยู่ในขั้นตอนพัฒนา หรือยังไม่ได้เชื่อมต่อ " +
  "ถ้ามีบล็อก [natal]/[memory] ให้ถือว่า engine คำนวณเสร็จแล้วและต้องใช้ตอบทันที " +
  "ถ้าคำถามเกี่ยวกับดวงจรแต่ไม่มีบล็อก [transit] ให้แนะนำให้ผู้ใช้เลือกเมนู「เริ่มดวงจร」ในแถบข้าง " +
  "ถ้าคำถามต้องการข้อมูลนอกบล็อกที่ให้มา ให้บอกข้อจำกัดอย่างสุภาพ อย่า invent";

/**
 * Always-on layout rule so replies render like ChatGPT/Grok/Gemini
 * even if Admin `format.*` templates are outdated.
 */
export const RESPONSE_LAYOUT_RULE =
  "รูปแบบคำตอบ (บังคับ): เขียน Markdown ที่อ่านง่ายเหมือนแชท AI จริง " +
  "ใช้ ## หรือ ### เป็นหัวข้อย่อย (ใช้ # ได้เมื่อเป็นหัวข้อหลักของคำตอบยาว) " +
  "ใช้รายการ `-` / `1.` เมื่อมีหลายประเด็น " +
  "ใช้ตาราง Markdown (| คอลัมน์ |) เมื่อสรุปดาว/เรือน/จังหวะหลายรายการ " +
  "ใช้ **ตัวหนา** เน้นคำสำคัญ เว้นย่อหน้าสั้น ๆ อ่านสบาย " +
  "ห้ามห่อคำตอบทั้งก้อนด้วย code fence " +
  "รักษาบุคลิกและน้ำเสียงจากบล็อก persona ตลอดการสนทนา — อย่าเปลี่ยนเป็นโทนหุ่นยนต์หรือเลิกเป็นตัวละครนั้น";

export function buildSystemPrompt(parts: PromptParts): string {
  return [
    parts.safety,
    ENGINE_CHART_RULE,
    parts.persona,
    parts.plan,
    parts.category,
    parts.knowledge,
    parts.outputFormat,
    // Layout last so it overrides outdated Admin format templates that banned headings.
    RESPONSE_LAYOUT_RULE,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export type BuildUserPromptOptions = {
  chartMemory?: UserChartMemoryJson | null;
  categorySlug?: string | null;
  transitChartJson?: ChartJson | null;
  /** Use compact natal block on follow-up turns to save input tokens. */
  compactNatal?: boolean;
};

function truncateAssistantHistory(content: string): string {
  if (content.length <= HISTORY_ASSISTANT_MAX_CHARS) return content;
  return `${content.slice(0, HISTORY_ASSISTANT_MAX_CHARS)}…`;
}

/**
 * Build the current-turn user prompt. Natal engine chart is required —
 * never call Gemini with profile/question alone.
 */
export function buildUserPrompt(
  profile: BirthProfileSnapshot,
  question: string,
  chartJson: ChartJson,
  options?: BuildUserPromptOptions,
): string {
  const opts = options ?? {};
  const natal = assertUsableEngineChart(chartJson);

  const formatNatal = opts.compactNatal ? formatChartCompactForPrompt : formatChartForPrompt;
  const lines: Array<string | null> = [
    formatNatal(natal, {
      title: opts.compactNatal
        ? "[natal] พื้นดวงจาก engine (ย่อ — ใช้ตำแหน่งดาวนี้เท่านั้น ห้ามแต่งดาว)"
        : "[natal] พื้นดวงจาก engine (ใช้ตารางนี้เท่านั้น ห้ามแต่งดาว)",
    }),
    "",
  ];

  if (opts.chartMemory) {
    lines.push(formatMemoryForPrompt(opts.chartMemory, opts.categorySlug), "");
  }

  if (opts.transitChartJson) {
    const transit = assertUsableEngineChart(opts.transitChartJson);
    lines.push(
      formatChartForPrompt(transit, {
        title: "[transit] ดวงจรจาก engine (ใช้ตารางนี้เท่านั้น ห้ามแต่งดาว)",
        preferTransitSamrap: true,
      }),
      "",
    );
  }

  lines.push(
    "ข้อมูลผู้ถาม:",
    profile.nickname ? `- ชื่อเล่น: ${profile.nickname}` : null,
    `- วันเกิด: ${profile.birthDate}`,
    profile.birthTimeKnown && profile.birthTime
      ? `- เวลาเกิด: ${profile.birthTime}`
      : "- เวลาเกิด: ไม่ทราบแน่ชัด",
    profile.gender ? `- เพศ/อัตลักษณ์: ${profile.gender}` : null,
    profile.birthLocation ? `- สถานที่เกิด: ${profile.birthLocation}` : null,
    profile.additionalInfo ? `- ข้อมูลเพิ่มเติม: ${profile.additionalInfo}` : null,
    "",
    `คำถาม: ${question}`,
  );

  const prompt = lines.filter((line): line is string => line !== null).join("\n");
  if (!prompt.includes("[natal]")) {
    throw new AppError("CHART_NOT_READY", "Engine chart missing from prompt");
  }
  if (opts.chartMemory && !prompt.includes("[memory]")) {
    throw new AppError("CHART_NOT_READY", "Chart memory missing from prompt");
  }
  return prompt;
}

export type PriorThreadMessage = {
  role: "USER" | "ASSISTANT";
  content: string;
};

/**
 * Build multi-turn history for the AI adapter from persisted thread messages.
 *
 * Chart + birth profile are always attached to the *current* userPrompt so
 * trimConversationHistory cannot drop natal evidence after ~10 turns.
 * Prior turns stay as plain text to keep token use bounded.
 */
export function buildConversationHistory(
  priorMessages: PriorThreadMessage[],
  profile: BirthProfileSnapshot,
  chartJson: ChartJson,
  currentQuestion: string,
  options?: BuildUserPromptOptions,
): { conversationHistory: ConversationTurn[]; userPrompt: string } {
  const history: ConversationTurn[] = [];

  for (const msg of priorMessages) {
    if (msg.role === "USER") {
      history.push({ role: "user", content: msg.content });
    } else {
      history.push({
        role: "assistant",
        content: truncateAssistantHistory(msg.content),
      });
    }
  }

  const isFollowUp = priorMessages.length > 0;
  const useCompactNatal = isFollowUp && !options?.transitChartJson;

  return {
    conversationHistory: trimConversationHistory(history),
    userPrompt: buildUserPrompt(
      profile,
      currentQuestion,
      chartJson,
      {
        ...options,
        compactNatal: useCompactNatal,
      },
    ),
  };
}

/** Keep only the most recent turns to stay within token budget. */
export function trimConversationHistory(history: ConversationTurn[]): ConversationTurn[] {
  const maxMessages = MAX_CONVERSATION_TURNS * 2;
  if (history.length <= maxMessages) return history;
  return history.slice(history.length - maxMessages);
}
