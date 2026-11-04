import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import { combineInsightGroups, insightSummarySchema, insightSystemPrompt, mergeInsightLabels, redactInsightText, specificInsightLabel, topInsights, type InsightGroup, type InsightState } from "@/lib/chat-insights";
import { generateOnce, resolveConfig } from "@/server/ai/router";
import { logUsage } from "@/server/ai/usage-logger";
import { writeAudit } from "@/server/audit/audit-service";

const KEY = "admin.chatInsights.v1", LEASE_MS = 30 * 60000;
function safeState(value: Prisma.JsonValue | undefined, updatedAt?: Date): InsightState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { status: "idle" };
  const state = value as unknown as InsightState;
  const parsed = insightSummarySchema.safeParse(state.summary);
  const summary = parsed.success ? parsed.data : undefined;
  if (state.status === "running" && updatedAt && Date.now() - updatedAt.getTime() > LEASE_MS) return { status: "error", error: "งานสรุปหยุดไป กรุณาประมวลผลใหม่", summary };
  return { status: ["running", "ready", "error"].includes(state.status) ? state.status : "idle", runId: state.runId, startedAt: state.startedAt, processed: state.processed, summary,
    ...(state.status === "error" ? { error: "สรุปไม่สำเร็จ กรุณาลองใหม่หรือตรวจการตั้งค่าโมเดล AI" } : {}) };
}
export async function getChatInsights() {
  const row = await prisma.appSetting.findUnique({ where: { key: KEY } });
  const [up, down] = await Promise.all(["UP", "DOWN"].map(value => prisma.messageFeedback.count({ where: { value: value as "UP" | "DOWN", message: { deletedAt: null } } })));
  return { ...safeState(row?.valueJson, row?.updatedAt), stats: { up, down, satisfactionPct: up + down ? up / (up + down) * 100 : null } };
}
export async function startChatInsights(actor: { id: string; ip?: string }) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(902641107)`;
    const row = await tx.appSetting.findUnique({ where: { key: KEY } });
    const previous = safeState(row?.valueJson, row?.updatedAt);
    if (previous.status === "running") throw new AppError("VALIDATION", "กำลังประมวลผลอยู่ กรุณารอให้งานเดิมเสร็จ");
    const state: InsightState = { status: "running", runId: randomUUID(), startedAt: new Date().toISOString(), processed: 0, ...(previous.summary ? { summary: previous.summary } : {}) };
    await tx.appSetting.upsert({ where: { key: KEY }, create: { key: KEY, valueJson: state as object }, update: { valueJson: state as object } });
    await writeAudit({ adminUserId: actor.id, action: "chat.insights.start", entityType: "chat_insights", entityId: state.runId, after: { cutoff: state.startedAt }, ipAddress: actor.ip }, tx);
    return state;
  });
}
async function store(state: InsightState) {
  const result = await prisma.appSetting.updateMany({ where: { key: KEY, valueJson: { path: ["runId"], equals: state.runId } }, data: { valueJson: state as object } });
  if (!result.count) throw new Error("Insight job replaced");
}

export async function runChatInsights(job: InsightState, actorId: string) {
  let phase = "load";
  try {
    const identities = await prisma.user.findMany({ select: { name: true, email: true, birthProfile: { select: { nickname: true, birthLocation: true, birthDistrict: true } } } });
    const names = [...new Set(identities.flatMap(u => [u.email, u.name, ...(u.name?.split(/\s+/u) ?? []), u.birthProfile?.nickname, u.birthProfile?.birthLocation, u.birthProfile?.birthDistrict]).filter((n): n is string => Boolean(n && n.length >= 3)))].sort((a, b) => b.length - a.length);
    let configId: string | undefined;
    const vocabulary = { USER: new Map<string, number>(), ASSISTANT: new Map<string, number>() };
    async function cluster(items: InsightGroup[], role: "USER" | "ASSISTANT", depth = 0): Promise<InsightGroup[]> {
      if (!configId) {
        const category = await prisma.horoscopeCategory.findFirst({ where: { enabled: true }, select: { id: true } });
        configId = (await resolveConfig(category?.id ?? "", "FREE", { preferFast: true })).id;
      }
      phase = "provider";
      const result = await generateOnce(configId, {
        systemPrompt: insightSystemPrompt(role),
        userPrompt: JSON.stringify({ role, knownSpecificLabels: [...vocabulary[role]].sort((a, b) => b[1] - a[1]).slice(0, 120).map(([label]) => label), items: items.map((g, id) => ({ id, text: g.label, occurrences: g.count })) }),
        maxOutputTokens: 12000, timeoutMs: 90000,
      });
      await logUsage({ userId: actorId, provider: result.provider, modelId: result.modelId, status: result.ok ? "SUCCESS" : "FAILED", inputUsage: result.usage?.inputTokens, outputUsage: result.usage?.outputTokens, cachedUsage: result.usage?.cachedTokens, latencyMs: result.latencyMs, errorCode: result.ok ? undefined : "ADMIN_INSIGHTS_FAILED" });
      if (!result.ok || !result.rawText) throw new Error("AI insight generation failed");
      phase = "validate-groups";
      try {
        if (result.truncated) throw new Error("Truncated grouping");
        const groups = combineInsightGroups(result.rawText, items, names);
        if (groups.some(group => !specificInsightLabel(group.label, role))) throw new Error("Broad category instead of a specific question/answer");
        for (const group of groups) vocabulary[role].set(group.label, (vocabulary[role].get(group.label) ?? 0) + group.count);
        return groups;
      } catch {
        // A large heterogeneous batch may omit/duplicate IDs or exceed output
        // budget. Discard that grouping and retry smaller complete batches.
        // Every retained group still passes the same strict coverage check.
        if (items.length <= 1 || depth >= 4) throw new Error("Invalid grouping after bounded retries");
        const middle = Math.ceil(items.length / 2);
        return [...await cluster(items.slice(0, middle), role, depth + 1), ...await cluster(items.slice(middle), role, depth + 1)];
      }
    }
    async function merge(groups: InsightGroup[], role: "USER" | "ASSISTANT") {
      groups = mergeInsightLabels(groups);
      // A fixed number of synonym-merging passes, NOT repeated compression
      // until 50 categories: that erased distinct questions into broad topics.
      for (let pass = 0; pass < 2 && groups.length > 1; pass++) {
        const before = groups.map(g => g.label).sort().join("\n");
        groups.sort((a, b) => a.label.localeCompare(b.label));
        const next: InsightGroup[] = [];
        for (let i = 0; i < groups.length; i += 80) next.push(...await cluster(groups.slice(i, i + 80), role));
        const merged = mergeInsightLabels(next);
        groups = merged;
        if (groups.map(g => g.label).sort().join("\n") === before) break;
      }
      return groups;
    }
    const cutoff = new Date(job.startedAt!);
    const totals = { USER: 0, ASSISTANT: 0 };
    const lists: Record<"USER" | "ASSISTANT", ReturnType<typeof topInsights>> = { USER: [], ASSISTANT: [] };
    for (const role of ["USER", "ASSISTANT"] as const) {
      const groups: InsightGroup[] = []; let cursor: string | undefined;
      async function consume(entries: InsightGroup[]) {
        totals[role] += entries.length;
        if (entries.length) groups.push(...await cluster(entries, role));
        job = { ...job, processed: totals.USER + totals.ASSISTANT }; await store(job);
      }
      for (;;) {
        const rows = await prisma.message.findMany({ where: { role, deletedAt: null, status: "SUCCESS", content: { not: "" }, createdAt: { lte: cutoff }, ...(cursor ? { id: { gt: cursor } } : {}) }, orderBy: { id: "asc" }, take: 80, select: { id: true, content: true, conversation: { select: { userId: true } } } });
        if (!rows.length) break;
        cursor = rows.at(-1)!.id;
        const entries = rows.filter(r => r.content.trim()).map(r => ({ label: redactInsightText(r.content, names).slice(0, role === "USER" ? 800 : 2000), count: 1, members: new Set([r.conversation.userId]) }));
        await consume(entries);
      }
      // Unkeyed legacy readings are distinct from the keyed chat flow. A keyed
      // orphan may belong to a hard-deleted conversation; never resurrect it.
      cursor = undefined;
      for (;;) {
        const rows: Array<{ id: string; userId: string; question: string; responseText: string | null; responseJson: Prisma.JsonValue | null }> = await prisma.$queryRaw`
          SELECT r.id, r."userId", r.question, r."responseText", r."responseJson"
          FROM horoscope_readings r
          WHERE r.status = 'SUCCESS' AND r."createdAt" <= ${cutoff}
            AND r."idempotencyKey" IS NULL
            ${cursor ? Prisma.sql`AND r.id > ${cursor}` : Prisma.empty}
            AND NOT EXISTS (
              SELECT 1 FROM messages m JOIN conversations c ON c.id = m."conversationId"
              WHERE c."userId" = r."userId" AND m."idempotencyKey" = r."idempotencyKey"
            )
          ORDER BY r.id ASC LIMIT 80`;
        if (!rows.length) break;
        cursor = rows.at(-1)!.id;
        const entries = rows.map(row => ({ row, text: role === "USER" ? row.question : row.responseText?.trim() || (row.responseJson ? JSON.stringify(row.responseJson) : "") }))
          .filter(({ text }) => text.trim()).map(({ row, text }) => ({ label: redactInsightText(text, names).slice(0, role === "USER" ? 800 : 2000), count: 1, members: new Set([row.userId]) }));
        await consume(entries);
      }
      lists[role] = topInsights(await merge(groups, role));
    }
    const summary = insightSummarySchema.parse({ generatedAt: new Date().toISOString(), cutoff: cutoff.toISOString(), questionsAnalyzed: totals.USER, answersAnalyzed: totals.ASSISTANT, questions: lists.USER, answers: lists.ASSISTANT });
    await store({ ...job, status: "ready", summary });
    await writeAudit({ adminUserId: actorId, action: "chat.insights.complete", entityType: "chat_insights", entityId: job.runId, after: { questionsAnalyzed: totals.USER, answersAnalyzed: totals.ASSISTANT } });
  } catch {
    await store({ ...job, status: "error" }).catch(() => {});
    console.error(`[chat-insights] summary failed at ${phase}; processed=${job.processed ?? 0}; no source content logged`);
  }
}
