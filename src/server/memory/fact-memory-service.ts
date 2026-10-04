import { prisma } from "@/server/db";
import { generateWithFallback } from "@/server/ai/router";
import { logUsage } from "@/server/ai/usage-logger";
import { resolveAuxConfig } from "@/server/horoscope/follow-up-suggestions";

/**
 * Saved memories, like ChatGPT's: after a turn, a small model reads what the
 * USER wrote and keeps the facts they told about themselves — work, plans,
 * goals, what they are going through — so every later chat knows them.
 * Only the user's own words are read (an earlier answer is not a fact about
 * them), nobody else's birth data is kept, and the list is shown and
 * deletable on the account page.
 */
export const MAX_FACTS = 40;
const FACT_MAX_CHARS = 140;

export type MemoryFact = { id: string; text: string; updatedAt: string };

export async function listMemoryFacts(userId: string): Promise<MemoryFact[]> {
  const rows = await prisma.userMemoryFact.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: MAX_FACTS,
    select: { id: true, text: true, updatedAt: true },
  });
  return rows.map((r) => ({ id: r.id, text: r.text, updatedAt: r.updatedAt.toISOString() }));
}

export async function deleteMemoryFact(userId: string, id: string): Promise<void> {
  await prisma.userMemoryFact.deleteMany({ where: { id, userId } });
}

export async function clearMemoryFacts(userId: string): Promise<void> {
  await prisma.userMemoryFact.deleteMany({ where: { userId } });
}

export type FactChanges = {
  add: string[];
  update: Array<{ id: string; text: string }>;
  remove: string[];
};

/** Someone's birth date or time is not ours to keep (owner rule). */
const BIRTH_DATA = /เกิด[^\n]{0,30}(\d{1,2}[\s/.-]|\d{4}|เวลา|โมง|น\.)|วันเกิด|เวลาเกิด/;

export function sanitizeFactChanges(raw: unknown, known: Set<string>): FactChanges {
  const out: FactChanges = { add: [], update: [], remove: [] };
  if (!raw || typeof raw !== "object") return out;
  const r = raw as { add?: unknown; update?: unknown; remove?: unknown };
  const clean = (t: unknown) =>
    typeof t === "string" ? t.replace(/\s+/g, " ").trim().slice(0, FACT_MAX_CHARS) : "";
  const ok = (t: string) => t.length >= 4 && !BIRTH_DATA.test(t);
  if (Array.isArray(r.add)) {
    for (const t of r.add.map(clean)) if (ok(t) && out.add.length < 5) out.add.push(t);
  }
  if (Array.isArray(r.update)) {
    for (const u of r.update) {
      const id = typeof (u as { id?: unknown })?.id === "string" ? (u as { id: string }).id : "";
      const text = clean((u as { text?: unknown })?.text);
      if (known.has(id) && ok(text)) out.update.push({ id, text });
    }
  }
  if (Array.isArray(r.remove)) {
    for (const id of r.remove) if (typeof id === "string" && known.has(id)) out.remove.push(id);
  }
  return out;
}

function parseJson(raw: string): unknown {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

/** Read the user's latest message and keep what it says about them. Never throws. */
export async function rememberFromTurn(input: {
  userId: string;
  conversationId: string;
  userMessage: string;
}): Promise<FactChanges | null> {
  try {
    const text = input.userMessage.trim();
    // "เล่าต่อ", "ok", one-word follow-ups carry nothing about the person.
    if (text.length < 12) return null;
    const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { aiMemoryEnabled: true } });
    if (!user?.aiMemoryEnabled) return null;

    const facts = await listMemoryFacts(input.userId);
    const cfg = await resolveAuxConfig();
    if (!cfg) return null;
    const result = await generateWithFallback(cfg.id, {
      systemPrompt: `คุณจดบันทึกความจำของผู้ใช้แอปดูดวง จากข้อความล่าสุดที่ผู้ใช้พิมพ์เอง
ตอบเป็น JSON เท่านั้น: {"add":["..."],"update":[{"id":"...","text":"..."}],"remove":["id"]}
จดเฉพาะข้อเท็จจริงที่ผู้ใช้บอกเกี่ยวกับตัวเองและยังใช้ได้ต่อไป เช่น อาชีพ งานที่ทำ เป้าหมาย แผน นัดสำคัญพร้อมวันที่ เรื่องที่กำลังเจอ สถานะความสัมพันธ์ คนสำคัญในชีวิต (ชื่อเล่น/ความสัมพันธ์เท่านั้น)
ห้ามจด: คำทำนายหรือสิ่งที่หมอดูพูด, คำถามลอย ๆ ที่ไม่ได้บอกอะไรเกี่ยวกับตัวเขา, วันเกิดหรือเวลาเกิดของใคร, เลขบัญชี/เบอร์โทร/ที่อยู่
แต่ละข้อสั้น ไม่เกิน 1 ประโยค เขียนในมุมบุคคลที่สาม เช่น "ทำงานฟรีแลนซ์ออกแบบกราฟิก" "มีนัดคุยงานกับลูกค้าวันที่ 14 ต.ค. 2569"
ถ้าข้อเดิมเปลี่ยนไป ให้ update ข้อนั้น ถ้าผู้ใช้บอกว่าข้อเดิมไม่จริงแล้ว ให้ remove ถ้าไม่มีอะไรใหม่ ตอบ {"add":[],"update":[],"remove":[]}`,
      userPrompt: `ความจำที่มีอยู่:\n${
        facts.length ? facts.map((f) => `- [${f.id}] ${f.text}`).join("\n") : "(ยังไม่มี)"
      }\n\nข้อความล่าสุดของผู้ใช้:\n${text.slice(0, 1_500)}`,
      maxOutputTokens: 512,
      timeoutMs: 10_000,
    });
    if (!result.ok || !result.rawText) return null;
    void logUsage({
      userId: input.userId,
      provider: result.provider,
      modelId: result.modelId,
      status: "SUCCESS",
      latencyMs: result.latencyMs,
      inputUsage: result.usage?.inputTokens,
      outputUsage: result.usage?.outputTokens,
      cachedUsage: result.usage?.cachedTokens,
      errorCode: "MEMORY_FACTS",
    }).catch(() => {});

    const changes = sanitizeFactChanges(parseJson(result.rawText), new Set(facts.map((f) => f.id)));
    const existing = new Set(facts.map((f) => f.text));
    for (const id of changes.remove) await prisma.userMemoryFact.deleteMany({ where: { id, userId: input.userId } });
    for (const u of changes.update) {
      await prisma.userMemoryFact.updateMany({ where: { id: u.id, userId: input.userId }, data: { text: u.text } });
    }
    for (const t of changes.add) {
      if (existing.has(t)) continue;
      await prisma.userMemoryFact.create({
        data: { userId: input.userId, text: t, sourceConversationId: input.conversationId },
      });
    }
    // Keep the newest MAX_FACTS.
    const overflow = await prisma.userMemoryFact.findMany({
      where: { userId: input.userId },
      orderBy: { updatedAt: "desc" },
      skip: MAX_FACTS,
      select: { id: true },
    });
    if (overflow.length) await prisma.userMemoryFact.deleteMany({ where: { id: { in: overflow.map((o) => o.id) } } });
    return changes;
  } catch (err) {
    console.warn("[memory-facts]", err instanceof Error ? err.message : err);
    return null;
  }
}
