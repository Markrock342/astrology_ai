import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// 12 Nov 2026: A asked whether «ประมวลผลข้อมูลล่าสุด» burns AI credit every
// press. It re-read every chat each time; now only chats after the last
// cutoff go to the AI, and the run records what it cost.

type Msg = { id: string; role: "USER" | "ASSISTANT"; content: string; createdAt: Date; userId: string };
const db = vi.hoisted(() => ({ settings: new Map<string, { valueJson: unknown; updatedAt: Date }>(), messages: [] as Msg[], prompts: [] as string[], failAfter: Infinity, garble: false }));

vi.mock("@/server/db", () => {
  const appSetting = {
    findUnique: async ({ where }: { where: { key: string } }) => {
      const row = db.settings.get(where.key);
      return row ? { key: where.key, ...row } : null;
    },
    upsert: async ({ where, create, update }: { where: { key: string }; create: { valueJson: unknown }; update: { valueJson: unknown } }) => {
      db.settings.set(where.key, { valueJson: structuredClone(db.settings.has(where.key) ? update.valueJson : create.valueJson), updatedAt: new Date() });
    },
    deleteMany: async ({ where }: { where: { key: string | { in: string[] } } }) => {
      for (const key of typeof where.key === "string" ? [where.key] : where.key.in) db.settings.delete(key);
      return { count: 1 };
    },
    updateMany: async ({ where, data }: { where: { key: string; valueJson: { equals: string } }; data: { valueJson: unknown } }) => {
      const row = db.settings.get(where.key);
      if (!row || (row.valueJson as { runId?: string }).runId !== where.valueJson.equals) return { count: 0 };
      db.settings.set(where.key, { valueJson: structuredClone(data.valueJson), updatedAt: new Date() });
      return { count: 1 };
    },
  };
  const prisma = {
    appSetting,
    user: { findMany: async () => [] },
    horoscopeCategory: { findFirst: async () => ({ id: "cat" }) },
    messageFeedback: { count: async () => 0 },
    $queryRaw: async () => [],
    message: {
      findMany: async ({ where, take }: { where: { role: string; createdAt: { lte: Date; gt?: Date }; id?: { gt: string } }; take: number }) =>
        db.messages
          .filter(m => m.role === where.role && m.createdAt <= where.createdAt.lte && (!where.createdAt.gt || m.createdAt > where.createdAt.gt) && (!where.id || m.id > where.id.gt))
          .sort((a, b) => a.id.localeCompare(b.id)).slice(0, take)
          .map(m => ({ id: m.id, content: m.content, conversation: { userId: m.userId } })),
    },
    $transaction: async (fn: (tx: unknown) => unknown) => fn(prisma),
  };
  return { prisma };
});
vi.mock("@/server/audit/audit-service", () => ({ writeAudit: async () => {} }));
vi.mock("@/server/ai/usage-logger", () => ({ logUsage: async () => {} }));
vi.mock("@/server/horoscope/follow-up-suggestions", () => ({ resolveAuxConfig: async () => ({ id: "cfg" }) }));
vi.mock("@/server/ai/router", () => ({
  // A stand-in model: groups each item by a keyword in its text.
  generateOnce: async (_id: string, input: { userPrompt: string }) => {
    if (db.prompts.length >= db.failAfter) return { ok: false, provider: "GEMINI", modelId: "gemini-3.5-flash-lite", latencyMs: 1, errorCode: "HTTP_500" };
    db.prompts.push(input.userPrompt);
    if (db.garble) return { ok: true, provider: "GEMINI", modelId: "gemini-3.5-flash-lite", rawText: "not json", usage: { inputTokens: 10, outputTokens: 1 }, latencyMs: 1 };
    const { role, items } = JSON.parse(input.userPrompt) as { role: string; items: Array<{ id: number; text: string }> };
    const label = (t: string) => role === "USER"
      ? (t.includes("งาน") ? "จะได้งานใหม่เมื่อไหร่?" : "ความรักจะเป็นอย่างไร?")
      : (t.includes("งาน") ? "ควรเตรียมทักษะก่อนเปลี่ยนงาน" : "ควรสื่อสารกับคนรักให้มากขึ้น");
    const groups = new Map<string, number[]>();
    for (const item of items) groups.set(label(item.text), [...(groups.get(label(item.text)) ?? []), item.id]);
    return { ok: true, provider: "GEMINI", modelId: "gemini-3.5-flash-lite", rawText: JSON.stringify({ groups: [...groups].map(([l, ids]) => ({ label: l, ids })) }), usage: { inputTokens: input.userPrompt.length * 100, outputTokens: 10_000, cachedTokens: 0 }, latencyMs: 1 };
  },
}));

import { getChatInsights, runChatInsights, startChatInsights } from "@/server/admin/chat-insights-service";

let clock = new Date("2026-11-01T00:00:00Z").getTime();
const at = (ms: number) => new Date(ms);
function chat(id: string, userId: string, topic: "งาน" | "รัก", when: number) {
  db.messages.push({ id: `${id}q`, role: "USER", content: `คำถามเรื่อง${topic} ${id}`, createdAt: at(when), userId });
  db.messages.push({ id: `${id}a`, role: "ASSISTANT", content: `คำตอบเรื่อง${topic} ${id}`, createdAt: at(when), userId });
}
async function press(full = false) {
  clock += 60_000;
  vi.setSystemTime(at(clock));
  db.prompts.length = 0;
  const job = await startChatInsights({ id: "admin" }, { full });
  await runChatInsights(job, "admin");
  return getChatInsights();
}

describe("chat insights only send new chats to the AI", () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); });
  afterAll(() => { vi.useRealTimers(); });

  it("reads everything once, then only what came after, and records the cost", async () => {
    for (const [i, u] of ["u1", "u2", "u3"].entries()) { chat(`a${i}`, u, "งาน", clock - 10_000); chat(`b${i}`, u, "รัก", clock - 10_000); }

    const first = await press();
    expect(first.status).toBe("ready");
    expect(first.summary).toMatchObject({ mode: "full", newQuestions: 6, newAnswers: 6, questionsAnalyzed: 6 });
    expect(first.summary!.aiCalls).toBeGreaterThan(0);
    expect(first.summary!.costUsd).toBeGreaterThan(0);
    expect(first.summary!.costThb).toBeGreaterThan(0);
    expect(first.summary!.questions).toEqual([
      { label: "ความรักจะเป็นอย่างไร?", count: 3 },
      { label: "จะได้งานใหม่เมื่อไหร่?", count: 3 },
    ]);

    // Two new chats about work after the first press.
    chat("c0", "u1", "งาน", clock + 1_000);
    chat("c1", "u4", "งาน", clock + 2_000);
    const second = await press();
    expect(second.summary).toMatchObject({ mode: "incremental", newQuestions: 2, newAnswers: 2, questionsAnalyzed: 8, answersAnalyzed: 8 });
    // No chat from before the first press reaches the AI again.
    const sent = db.prompts.join("\n");
    // (Digits are masked before anything leaves: "a0" goes out as "a[ตัวเลข]".)
    expect(sent).not.toMatch(/ [ab]\[ตัวเลข\]/);
    expect(sent).toContain(" c[ตัวเลข]");
    expect(second.summary!.questions[0]).toEqual({ label: "จะได้งานใหม่เมื่อไหร่?", count: 5 });
    expect(second.summary!.costUsd!).toBeLessThan(first.summary!.costUsd!);

    // Nothing new: no AI call at all, the lists stay.
    const third = await press();
    expect(third.summary).toMatchObject({ mode: "incremental", newQuestions: 0, aiCalls: 0, costUsd: 0, questionsAnalyzed: 8 });
    expect(db.prompts).toHaveLength(0);
    expect(third.summary!.questions).toEqual(second.summary!.questions);

    // «ประมวลผลใหม่ทั้งหมด» reads every chat again.
    const full = await press(true);
    expect(full.summary).toMatchObject({ mode: "full", newQuestions: 8, questionsAnalyzed: 8 });
    expect(db.prompts.join("\n")).toContain(" a[ตัวเลข]");
  });
});

describe("a press that dies halfway is not paid for twice", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    db.settings.clear(); db.messages.length = 0; db.failAfter = Infinity; db.garble = false;
  });

  it("resumes from the last finished batch", async () => {
    // 200 questions = 3 batches of 80, plus 200 answers.
    for (let i = 0; i < 200; i++) chat(`m${String(i).padStart(3, "0")}`, `u${i % 5}`, i % 2 ? "งาน" : "รัก", clock - 10_000);

    db.failAfter = 2; // the provider breaks on the third batch
    const broken = await press();
    expect(broken.status).toBe("error");
    expect(db.prompts).toHaveLength(2);

    db.failAfter = Infinity;
    const resumed = await press();
    expect(resumed.status).toBe("ready");
    // The two question batches already paid for are not sent again.
    const questionBatches = db.prompts.filter(p => p.includes('"role":"USER"') && p.includes("คําถามเรื่อง"));
    expect(questionBatches).toHaveLength(1);
    expect(resumed.summary).toMatchObject({ mode: "full", questionsAnalyzed: 200, answersAnalyzed: 200 });
    expect(resumed.summary!.questions.reduce((n, q) => n + q.count, 0)).toBe(200);
    expect(db.settings.has("admin.chatInsights.progress.v1")).toBe(false);
  });

  it("files what the model cannot group under «other» instead of failing the run", async () => {
    for (const [i, u] of ["u1", "u2", "u3"].entries()) chat(`g${i}`, u, "งาน", clock - 10_000);
    db.garble = true;
    const result = await press();
    expect(result.status).toBe("ready");
    expect(result.summary).toMatchObject({ questionsAnalyzed: 3, questions: [], answers: [] });
  });
});
