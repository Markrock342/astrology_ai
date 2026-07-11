import type { BirthProfileSnapshot, ConversationTurn } from "@/types";
import type { ChartJson } from "@/types/chart";
import { MAX_CONVERSATION_TURNS } from "@/config/constants";
import { formatChartForPrompt } from "@/server/horoscope/engine/format-chart-prompt";

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
  "กฎบังคับ: ใช้เฉพาะตำแหน่งดาว ลัคนา ทักษา และตารางจากบล็อกข้อมูลดวงที่ระบบคำนวณให้มาเท่านั้น " +
  "ห้ามแต่ง ห้ามเดา ห้ามสมมติตำแหน่งดาวหรือราศีเอง " +
  "ทบทวนตารางก่อนตอบ: ดาวอยู่ราศี/เรือนใด มาตรฐาน (อุจจ์/นีจ/สวักษ์) สัมพันธ์ดาวเป็นอย่างไร " +
  "ตอบคำถามผู้ใช้ตรง ๆ — ห้ามพิมพ์อธิบายว่า 'นี่คือพื้นดวง' 'ระบบคำนวณให้' หรือสอนว่ากราฟคืออะไร " +
  "ถ้าคำถามต้องการข้อมูลนอกบล็อกที่ให้มา ให้บอกข้อจำกัดอย่างสุภาพ อย่า invent";

export function buildSystemPrompt(parts: PromptParts): string {
  return [
    parts.safety,
    ENGINE_CHART_RULE,
    parts.persona,
    parts.plan,
    parts.category,
    parts.knowledge,
    parts.outputFormat,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildUserPrompt(
  profile: BirthProfileSnapshot,
  question: string,
  chartJson?: ChartJson | null,
  transitChartJson?: ChartJson | null,
): string {
  const lines: Array<string | null> = [];

  if (chartJson) {
    lines.push(
      formatChartForPrompt(chartJson, {
        title: "[natal] พื้นดวง (คำนวณในเครื่อง — ใช้ตารางนี้เท่านั้น ห้ามแต่งดาว)",
      }),
      "",
    );
  }

  if (transitChartJson) {
    lines.push(
      formatChartForPrompt(transitChartJson, {
        title: "[transit] ดวงจรจากตาราง (ใช้ตารางนี้เท่านั้น ห้ามแต่งดาว)",
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

  return lines.filter((line): line is string => line !== null).join("\n");
}

export type PriorThreadMessage = {
  role: "USER" | "ASSISTANT";
  content: string;
};

/**
 * Build multi-turn history for the AI adapter from persisted thread messages.
 * The first user turn is enriched with birth profile + chart (not stored in DB).
 */
export function buildConversationHistory(
  priorMessages: PriorThreadMessage[],
  profile: BirthProfileSnapshot,
  chartJson: ChartJson | null | undefined,
  currentQuestion: string,
  transitChartJson?: ChartJson | null,
): { conversationHistory: ConversationTurn[]; userPrompt: string } {
  if (priorMessages.length === 0) {
    return {
      conversationHistory: [],
      userPrompt: buildUserPrompt(
        profile,
        currentQuestion,
        chartJson,
        transitChartJson,
      ),
    };
  }

  const history: ConversationTurn[] = [];
  let firstUser = true;

  for (const msg of priorMessages) {
    if (msg.role === "USER") {
      history.push({
        role: "user",
        content: firstUser
          ? buildUserPrompt(profile, msg.content, chartJson, transitChartJson)
          : msg.content,
      });
      firstUser = false;
    } else {
      history.push({ role: "assistant", content: msg.content });
    }
  }

  return {
    conversationHistory: trimConversationHistory(history),
    userPrompt: currentQuestion,
  };
}

/** Keep only the most recent turns to stay within token budget. */
export function trimConversationHistory(history: ConversationTurn[]): ConversationTurn[] {
  const maxMessages = MAX_CONVERSATION_TURNS * 2;
  if (history.length <= maxMessages) return history;
  return history.slice(history.length - maxMessages);
}
