import { z } from "zod";
export const insightSummarySchema = z.object({
  generatedAt: z.string(), cutoff: z.string(), questionsAnalyzed: z.number().int().nonnegative(), answersAnalyzed: z.number().int().nonnegative(),
  questions: z.array(z.object({ label: z.string().max(200), count: z.number().int().positive() })).max(50),
  answers: z.array(z.object({ label: z.string().max(200), count: z.number().int().positive() })).max(50),
});
export type InsightSummary = z.infer<typeof insightSummarySchema>;
export type InsightState = { status: "idle" | "running" | "ready" | "error"; runId?: string; startedAt?: string; processed?: number; error?: string; summary?: InsightSummary };

/** Remove known member identifiers and common identifier formats BEFORE AI. */
const identityPatterns = new WeakMap<string[], RegExp | null>();
export function redactInsightText(text: string, identities: string[]): string {
  let result = text.normalize("NFKC");
  if (!identityPatterns.has(identities)) {
    const escaped = identities.filter(name => name.trim().length >= 3).map(name => name.normalize("NFKC").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    identityPatterns.set(identities, escaped.length ? new RegExp(escaped.join("|"), "giu") : null);
  }
  const pattern = identityPatterns.get(identities);
  if (pattern) result = result.replace(pattern, "[บุคคล]");
  return result
    .replace(/https?:\/\/\S+|www\.\S+/giu, "[ลิงก์]")
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/giu, "[อีเมล]")
    .replace(/(^|[\s:])(?:นาย|นางสาว|นาง|ชื่อจริง|ชื่อเล่น)\s*[^\s,.:;\n]{2,40}/gu, "$1[บุคคล]")
    .replace(/[0-9๐-๙][0-9๐-๙\s+().:/-]*/gu, "[ตัวเลข]")
    .replace(/\s+/gu, " ").trim();
}
export type InsightGroup = { label: string; count: number; members: Set<string> };
export function mergeInsightLabels(groups: InsightGroup[]): InsightGroup[] {
  const merged = new Map<string, InsightGroup>();
  for (const group of groups) {
    const key = group.label.normalize("NFKC").trim().toLowerCase();
    const previous = merged.get(key);
    if (!previous) merged.set(key, { ...group, members: new Set(group.members) });
    else { previous.count += group.count; for (const member of group.members) previous.members.add(member); }
  }
  return [...merged.values()];
}
const groupsSchema = z.object({ groups: z.array(z.object({ label: z.string().min(3).max(200), ids: z.array(z.number().int().nonnegative()).min(1) })).min(1).max(50) });
/** The model may group IDs, but counts and membership always come from DB. */
export function combineInsightGroups(raw: string, source: InsightGroup[], identities: string[]): InsightGroup[] {
  const parsed = groupsSchema.parse(JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")));
  const seen = new Set<number>();
  const result = parsed.groups.map(group => {
    const members = new Set<string>(); let count = 0;
    for (const id of group.ids) {
      if (id >= source.length || seen.has(id)) throw new Error("Invalid or duplicate insight ID");
      seen.add(id); count += source[id].count;
      for (const member of source[id].members) members.add(member);
    }
    return { label: redactInsightText(group.label, identities), count, members };
  });
  if (seen.size !== source.length) throw new Error("Incomplete insight coverage");
  return result;
}
export function topInsights(groups: InsightGroup[]) {
  return groups.filter(g => g.members.size >= 3).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, 50).map(({ label, count }) => ({ label, count }));
}
