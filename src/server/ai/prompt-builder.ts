import type { BirthProfileSnapshot, ConversationTurn } from "@/types";
import type { ChartJson } from "@/types/chart";
import { MAX_CONVERSATION_TURNS } from "@/config/constants";
import { formatChartForPrompt } from "@/server/horoscope/engine/format-chart-prompt";

/**
 * Composes the final prompt in the order defined by spec 7.2:
 *   1. Global safety   2. Brand/persona   3. Plan   4. Category
 *   5. Basic knowledge 6. Birth profile   7. User question   8. Output format
 */
export type PromptParts = {
  safety: string;
  persona: string;
  plan: string;
  category: string;
  knowledge?: string;
  outputFormat: string;
};

export function buildSystemPrompt(parts: PromptParts): string {
  return [
    parts.safety,
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
): string {
  const lines = [
    chartJson ? formatChartForPrompt(chartJson) : null,
    chartJson ? "" : null,
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
  ].filter((line) => line !== null);

  return lines.join("\n");
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
): { conversationHistory: ConversationTurn[]; userPrompt: string } {
  if (priorMessages.length === 0) {
    return {
      conversationHistory: [],
      userPrompt: buildUserPrompt(profile, currentQuestion, chartJson),
    };
  }

  const history: ConversationTurn[] = [];
  let firstUser = true;

  for (const msg of priorMessages) {
    if (msg.role === "USER") {
      history.push({
        role: "user",
        content: firstUser
          ? buildUserPrompt(profile, msg.content, chartJson)
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
