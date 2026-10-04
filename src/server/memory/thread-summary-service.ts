import { prisma } from "@/server/db";
import { generateWithFallback } from "@/server/ai/router";
import { logUsage } from "@/server/ai/usage-logger";
import { resolveAuxConfig } from "@/server/horoscope/follow-up-suggestions";
import { MAX_CONVERSATION_TURNS } from "@/config/constants";

/**
 * A chat longer than the turns sent as history used to lose its beginning.
 * The messages that fall out of the window are folded, a few at a time, into
 * a short running summary kept on the conversation; every turn gets the
 * summary and then the recent turns, as ChatGPT does with long chats.
 */
const WINDOW_MESSAGES = MAX_CONVERSATION_TURNS * 2;
/** Fold when at least this many messages have left the window unsummarised. */
const FOLD_EVERY = 6;
const SUMMARY_MAX_CHARS = 1_800;
const MESSAGE_MAX_CHARS = 1_200;

export async function getThreadSummary(conversationId: string): Promise<string | null> {
  const row = await prisma.conversation.findUnique({ where: { id: conversationId }, select: { summary: true } });
  return row?.summary?.trim() || null;
}

/** Fold messages that left the history window into the summary. Never throws. */
export async function foldThreadSummary(input: { conversationId: string; userId: string }): Promise<boolean> {
  try {
    const conv = await prisma.conversation.findFirst({
      where: { id: input.conversationId, userId: input.userId },
      select: { summary: true, summaryCovers: true },
    });
    if (!conv) return false;
    const messages = await prisma.message.findMany({
      where: {
        conversationId: input.conversationId,
        deletedAt: null,
        OR: [{ role: "USER" }, { role: "ASSISTANT", status: "SUCCESS" }],
      },
      orderBy: { createdAt: "asc" },
      select: { role: true, content: true },
    });
    const outOfWindow = Math.max(0, messages.length - WINDOW_MESSAGES);
    if (outOfWindow - conv.summaryCovers < FOLD_EVERY) return false;

    const fresh = messages.slice(conv.summaryCovers, outOfWindow);
    const cfg = await resolveAuxConfig();
    if (!cfg) return false;
    const transcript = fresh
      .map((m) => `${m.role === "USER" ? "ผู้ใช้" : "หมอดู"}: ${m.content.replace(/\s+/g, " ").trim().slice(0, MESSAGE_MAX_CHARS)}`)
      .join("\n");
    const result = await generateWithFallback(cfg.id, {
      systemPrompt: `สรุปบทสนทนาดูดวงช่วงก่อนหน้าให้สั้นที่สุดโดยไม่ทิ้งเรื่องสำคัญ เป็นภาษาไทย ตอบเป็นข้อ ๆ ขึ้นต้นด้วย "- " ไม่เกิน 12 ข้อ
เก็บ: เรื่องที่ผู้ใช้ถามและเล่า, วันที่/ช่วงเวลาที่พูดถึงพร้อมผลที่หมอดูให้ (เช่น วันเด่น วันควรระวัง), คำแนะนำสำคัญ, เรื่องที่ยังค้างคุยต่อ
รวมกับสรุปเดิม (ถ้ามี) ให้เป็นสรุปเดียว ห้ามแต่งเพิ่ม ห้ามใส่หัวข้อ`,
      userPrompt: `${conv.summary ? `สรุปเดิม:\n${conv.summary}\n\n` : ""}ข้อความที่ต้องสรุปเพิ่ม:\n${transcript}`,
      maxOutputTokens: 1_024,
      timeoutMs: 15_000,
    });
    if (!result.ok || !result.rawText?.trim()) return false;
    void logUsage({
      userId: input.userId,
      provider: result.provider,
      modelId: result.modelId,
      status: "SUCCESS",
      latencyMs: result.latencyMs,
      inputUsage: result.usage?.inputTokens,
      outputUsage: result.usage?.outputTokens,
      cachedUsage: result.usage?.cachedTokens,
      errorCode: "THREAD_SUMMARY",
    }).catch(() => {});
    // Compare-and-set: a parallel fold of the same range must not double up.
    const saved = await prisma.conversation.updateMany({
      where: { id: input.conversationId, summaryCovers: conv.summaryCovers },
      data: {
        summary: result.rawText.trim().slice(0, SUMMARY_MAX_CHARS),
        summaryCovers: outOfWindow,
        summaryAt: new Date(),
      },
    });
    return saved.count > 0;
  } catch (err) {
    console.warn("[thread-summary]", err instanceof Error ? err.message : err);
    return false;
  }
}
