import type { BirthProfileSnapshot } from "@/types";
import type { ChartJson } from "@/types/chart";
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
