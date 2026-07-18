import { prisma } from "@/server/db";
import {
  generateWithFallback,
  resolveConfig,
} from "@/server/ai/router";
import { logUsage } from "@/server/ai/usage-logger";

export type FollowUpMeta = {
  summaryLine?: string;
  followUps: string[];
};

const SUMMARY_MAX_CHARS = 120;
const FOLLOW_UP_MAX_CHARS = 60;
const FOLLOW_UP_MAX_COUNT = 3;

function parseFollowUpJson(raw: string): unknown {
  const trimmed = raw.trim();
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as unknown;
  } catch {
    return null;
  }
}

/** Normalize model JSON — exported for unit tests. */
export function sanitizeFollowUpMeta(raw: unknown): FollowUpMeta {
  if (!raw || typeof raw !== "object") return { followUps: [] };

  const obj = raw as { summaryLine?: unknown; followUps?: unknown };
  let summaryLine: string | undefined;

  if (typeof obj.summaryLine === "string") {
    const trimmed = obj.summaryLine.trim();
    if (trimmed) {
      summaryLine =
        trimmed.length > SUMMARY_MAX_CHARS
          ? trimmed.slice(0, SUMMARY_MAX_CHARS)
          : trimmed;
    }
  }

  const followUps: string[] = [];
  if (Array.isArray(obj.followUps)) {
    for (const item of obj.followUps) {
      if (typeof item !== "string") continue;
      const trimmed = item.trim();
      if (!trimmed) continue;
      followUps.push(
        trimmed.length > FOLLOW_UP_MAX_CHARS
          ? trimmed.slice(0, FOLLOW_UP_MAX_CHARS)
          : trimmed,
      );
      if (followUps.length >= FOLLOW_UP_MAX_COUNT) break;
    }
  }

  return { summaryLine, followUps };
}

/**
 * Resolve a cheap/fast config for auxiliary calls (title + follow-up chips).
 * Prefers the same routing as brief chat (`preferFast`), then any enabled lite
 * model, then the first enabled config. Never throws — callers treat miss as skip.
 */
export async function resolveAuxConfig(opts?: {
  categoryId?: string | null;
  planScope?: "FREE" | "PRO";
}) {
  if (opts?.categoryId) {
    try {
      return await resolveConfig(opts.categoryId, opts.planScope ?? "FREE", {
        preferFast: true,
      });
    } catch {
      /* fall through to global enabled list */
    }
  }

  const candidates = await prisma.aIProviderConfig.findMany({
    where: { enabled: true },
    orderBy: [{ provider: "asc" }, { displayName: "asc" }],
  });
  if (candidates.length === 0) return null;
  const lite = candidates.find((c) =>
    c.modelId.toLowerCase().includes("lite"),
  );
  return lite ?? candidates[0];
}

/**
 * Name a conversation after its first exchange.
 *
 * The sidebar used to show the first 48 characters of the question, cut
 * mid-word — "สรุปสั้น ๆ โชคลาภช่วงนี้เป็นอย่า…". ChatGPT titles threads with a
 * cheap model; so do we now. Best-effort: on any failure the truncated-question
 * fallback that appendUserMessage already set simply stays.
 */
export async function generateThreadTitle(input: {
  conversationId: string;
  userId: string;
  question: string;
  answer: string;
  categoryId?: string | null;
  planScope?: "FREE" | "PRO";
}): Promise<string | null> {
  try {
    // Only the FIRST exchange names the thread — and only while the title is
    // still the auto-truncated question, so a rename by the user is never
    // overwritten.
    const [conversation, liveAnswers] = await Promise.all([
      prisma.conversation.findFirst({
        where: { id: input.conversationId, userId: input.userId },
        select: { id: true, title: true, categoryId: true },
      }),
      prisma.message.count({
        where: {
          conversationId: input.conversationId,
          role: "ASSISTANT",
          status: "SUCCESS",
          deletedAt: null,
        },
      }),
    ]);
    if (!conversation || liveAnswers > 1) return null;

    const cfg = await resolveAuxConfig({
      categoryId: input.categoryId ?? conversation.categoryId,
      planScope: input.planScope,
    });
    if (!cfg) return null;

    const result = await generateWithFallback(cfg.id, {
      systemPrompt:
        "ตั้งชื่อหัวข้อบทสนทนาดูดวงเป็นภาษาไทย สั้น กระชับ ไม่เกิน 30 ตัวอักษร " +
        "ตอบเป็นชื่อหัวข้ออย่างเดียว ห้ามใส่เครื่องหมายคำพูด ห้ามอธิบาย",
      userPrompt: `คำถาม: ${input.question.slice(0, 300)}\n\nคำตอบ (ย่อ): ${input.answer.slice(0, 400)}`,
      // Gemini 3.x draws MINIMAL-level thinking from THIS budget (2.5 kept it
      // separate). 96 could be spent entirely on thinking → empty title, so the
      // sidebar kept the raw truncated question. Leave room for thinking + title.
      maxOutputTokens: 192,
      timeoutMs: 6_000,
    });
    if (!result.ok || !result.rawText) return null;

    const title = result.rawText.trim().replace(/^["'「]+|["'」]+$/g, "").slice(0, 48);
    if (!title) return null;

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { title },
    });
    return title;
  } catch {
    return null;
  }
}

/**
 * Post-answer meta via the admin-configured fast model — no credit charge,
 * must never fail the turn. Uses the same AI config routing as brief chat.
 */
export async function generateFollowUpMeta(input: {
  userId: string;
  question: string;
  answer: string;
  categoryName: string;
  categoryId?: string | null;
  planScope?: "FREE" | "PRO";
}): Promise<FollowUpMeta> {
  try {
    const cfg = await resolveAuxConfig({
      categoryId: input.categoryId,
      planScope: input.planScope,
    });
    if (!cfg) return { followUps: [] };

    const answerSnippet = input.answer.trim().slice(0, 1_200);

    const result = await generateWithFallback(cfg.id, {
      systemPrompt: `คุณช่วยสรุปคำทำนายและเสนอคำถามต่อเนื่องเป็นภาษาไทย
ตอบเป็น JSON เท่านั้น ห้ามใส่ markdown หรือข้อความนอก JSON:
{"summaryLine":"...","followUps":["...","..."]}
กติกา:
- summaryLine: บรรทัดเดียว ไม่เกิน 120 ตัวอักษร (optional)
- followUps: 0–3 คำถามสั้นที่ผู้ใช้ถามต่อได้ แต่ละข้อไม่เกิน 60 ตัวอักษร`,
      userPrompt: `หมวด: ${input.categoryName}
คำถาม: ${input.question}

คำตอบ:
${answerSnippet}`,
      // Thai JSON (summary + 3 questions) plus Gemini-3.x MINIMAL thinking —
      // both drawn from this budget — overran 320 and came back truncated
      // (unparseable → no chips). Raised so the JSON survives the thinking spend.
      maxOutputTokens: 512,
      timeoutMs: 8_000,
    });

    if (!result.ok || !result.rawText) {
      return { followUps: [] };
    }

    const parsed = parseFollowUpJson(result.rawText);
    const meta = sanitizeFollowUpMeta(parsed);

    void logUsage({
      userId: input.userId,
      provider: result.provider,
      modelId: result.modelId,
      status: "SUCCESS",
      latencyMs: result.latencyMs,
      inputUsage: result.usage?.inputTokens,
      outputUsage: result.usage?.outputTokens,
      cachedUsage: result.usage?.cachedTokens,
      errorCode: "FOLLOW_UP_META",
    }).catch(() => {});

    return meta;
  } catch {
    return { followUps: [] };
  }
}
