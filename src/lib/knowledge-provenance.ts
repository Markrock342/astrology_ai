export type KnowledgeSource = "TEAM" | "DEFAULT" | "SYSTEM_GUIDE" | "UNKNOWN";
export type KnowledgeProvenance = {
  source: KnowledgeSource;
  createdBy: string | null;
  statusChangedAt: string | null;
  statusChangedBy: string | null;
  statusReason: string | null;
};
export const KNOWLEDGE_SOURCE_LABELS: Record<KnowledgeSource, string> = {
  TEAM: "เอกสารที่ทีมเพิ่ม", DEFAULT: "ชุดความรู้ตั้งต้น", SYSTEM_GUIDE: "คู่มือระบบสำหรับทีม", UNKNOWN: "ไม่พบที่มาในประวัติเดิม",
};
const defaultIds = new Set(["kb-global-foundation", "kb-global-planets", "kb-global-houses", "kb-global-taksa-aspects", "kb-global-signs", "kb-global-divisional-charts", "kb-global-calc-tools", "kb-global-engine-ops"]);
const defaultCategories = new Set(["self", "career", "finance", "love", "health", "fortune", "overview"]);
export function knowledgeSource(id: string, hasCreationAudit: boolean): KnowledgeSource {
  if (id === "kb-team-engine-formulas") return "SYSTEM_GUIDE";
  if (hasCreationAudit) return "TEAM";
  if (defaultIds.has(id) || (id.startsWith("seed-knowledge-cat-") && defaultCategories.has(id.slice("seed-knowledge-cat-".length)))) return "DEFAULT";
  return "UNKNOWN";
}
