import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
const url = new URL(process.env.DATABASE_URL ?? "postgresql://invalid/invalid");
if (!["localhost", "127.0.0.1"].includes(url.hostname) || !/^\/hora_admin_filter_test(?:_[a-zA-Z0-9_-]+)?$/.test(url.pathname)) throw Error("Isolated local test DB required");
const db = new PrismaClient({ datasources: { db: { url: url.href } } });
vi.mock("@/server/db", () => ({ get prisma() { return db; } }));
const prompts: string[] = [];
let invalidNextGrouping = false;
let invalidAllGroupings = false;
let failProvider = false;
vi.mock("@/server/ai/router", () => ({ resolveConfig: async () => ({ id: "test-only" }), generateOnce: async (_id: string, input: { userPrompt: string }) => {
  prompts.push(input.userPrompt);const rows = JSON.parse(input.userPrompt) as { id: number }[];
  if (failProvider) return { ok: false, provider: "GEMINI", modelId: "gemini-test-fixture", latencyMs: 1, errorCode: "OVERLOADED" };
  if (invalidNextGrouping || invalidAllGroupings) { invalidNextGrouping = false; return { ok: true, provider: "GEMINI", modelId: "gemini-test-fixture", latencyMs: 1, rawText: '{"groups":[{"label":"หัวข้อทดสอบ","ids":[0,0]}]}' }; }
  return { ok: true, provider: "GEMINI", modelId: "gemini-test-fixture", latencyMs: 1, rawText: JSON.stringify({ groups: [{ label: "แนวโน้มด้านการงานโดยรวม", ids: rows.map(r => r.id) }] }) };
} }));
const { exportMembers } = await import("@/server/admin/member-export-service");
const { getChatInsights, startChatInsights, runChatInsights } = await import("@/server/admin/chat-insights-service");
const prefix = "admin-privacy-export-", admin = prefix + "admin", key = "admin.chatInsights.v1";
let categoryId: string;
beforeAll(async () => {
  await db.user.create({ data: { id: admin, email: `${admin}@example.invalid`, role: "ADMIN", name: "Operator" } });
  categoryId = (await db.horoscopeCategory.create({ data: { slug: prefix + "self", nameTh: "test" } })).id;
});
afterAll(async () => {
  await db.appSetting.deleteMany({ where: { key } });
  await db.aIUsageLog.deleteMany({ where: { userId: admin } });
  await db.adminAuditLog.deleteMany({ where: { adminUserId: admin } });
  await db.user.deleteMany({ where: { id: { startsWith: prefix } } });
  await db.horoscopeCategory.delete({ where: { id: categoryId } }); await db.$disconnect();
});
describe("real DB member export and private chat summary", () => {
  it("exports every matching member beyond one UI page, filters by Bangkok signup day, excludes staff, preserves wallet", async () => {
    const now = new Date("2026-11-04T04:00:00Z");
    await db.user.createMany({ data: Array.from({ length: 505 }, (_, i) => ({ id: prefix + `member-${i}`, email: `${prefix}member-${i}@example.invalid`, createdAt: new Date("2026-11-01T00:00Z") })) });
    await db.user.create({ data: { id: prefix + "old", email: `${prefix}old@example.invalid`, createdAt: new Date("2026-10-01T00:00Z") } });
    await db.usageWallet.create({ data: { userId: prefix + "member-0", includedBalanceUnits: 75000, purchasedBalanceUnits: 0, periodEndsAt: new Date("2026-11-04T16:59:59Z"), purchasedExpiresAt: new Date("2026-11-11T10:00Z") } });
    const before = await db.usageWallet.findUniqueOrThrow({ where: { userId: prefix + "member-0" } });
    const csv = await exportMembers("7", { id: admin }, { search: prefix }, now);
    expect(csv.split("\r\n")).toHaveLength(507); // header + 505 + final newline
    expect(csv).not.toContain(`${prefix}old@example.invalid`); expect(csv).not.toContain(`${admin}@example.invalid`);
    expect(csv).toContain('"04/11/2026","5"');
    const all = await exportMembers("all", { id: admin }, { search: prefix }, now);
    expect(all).toContain(`${prefix}old@example.invalid`);
    expect(await db.usageWallet.findUniqueOrThrow({ where: { userId: prefix + "member-0" } })).toEqual(before);
    expect(await db.adminAuditLog.count({ where: { action: "user.export", adminUserId: admin } })).toBe(2);
  });
  it("locks duplicate jobs, scans all messages, strips identifiers before AI and exposes aggregates only", async () => {
    for (let i = 0; i < 3; i++) await db.user.create({ data: {
      id: prefix + `chat-${i}`, email: `private-person-${i}@example.invalid`, name: `SecretPerson${i}`,
      conversations: { create: { categoryId, messages: { create: [
        { role: "USER", content: `ฉันชื่อ SecretPerson${i} private-person-${i}@example.invalid โทร 0812345678 อยากเปลี่ยนงาน` },
        { role: "ASSISTANT", content: `SecretPerson${i} ควรเตรียมตัวก่อนเปลี่ยนงานในวันที่ 04/11/2026` },
        { role: "USER", content: "deleted private message", deletedAt: new Date() },
        { role: "ASSISTANT", content: "failed private answer", status: "FAILED" },
      ] } } },
    } });
    const job = await startChatInsights({ id: admin });
    await expect(startChatInsights({ id: admin })).rejects.toThrow("กำลังประมวลผล");
    await runChatInsights(job, admin);
    const result = await getChatInsights();
    expect(result.status).toBe("ready");
    expect(result.summary).toMatchObject({ questionsAnalyzed: 3, answersAnalyzed: 3, questions: [{ count: 3 }], answers: [{ count: 3 }] });
    const output = JSON.stringify(result);
    for (const identity of ["SecretPerson", "private-person", "0812345678", "04/11/2026", "deleted private", "failed private"]) {
      expect(prompts.join(" ")).not.toContain(identity); expect(output).not.toContain(identity);
    }
    expect(output).not.toContain("userId"); expect(output).not.toContain("messageId"); expect(output).not.toContain("content");
    expect(await db.aIUsageLog.count({ where: { userId: admin } })).toBeGreaterThan(0);
  });
  it("retries invalid AI ID coverage in smaller batches without dropping or double-counting messages", async () => {
    const before = prompts.length;
    invalidNextGrouping = true;
    const job = await startChatInsights({ id: admin });
    await runChatInsights(job, admin);
    const result = await getChatInsights();
    expect(result.status).toBe("ready");
    expect(result.summary).toMatchObject({ questionsAnalyzed: 3, answersAnalyzed: 3, questions: [{ count: 3 }], answers: [{ count: 3 }] });
    const sizes = prompts.slice(before).map(p => (JSON.parse(p) as unknown[]).length);
    expect(sizes).toContain(1); expect(sizes).toContain(2);
  });
  it("bounds invalid-output retries and retains the previous aggregate instead of publishing partial counts", async () => {
    const previous = (await getChatInsights()).summary;
    const before = prompts.length;
    invalidAllGroupings = true;
    try {
      await runChatInsights(await startChatInsights({ id: admin }), admin);
      const result = await getChatInsights();
      expect(result.status).toBe("error"); expect(result.summary).toEqual(previous);
      expect(prompts.length - before).toBeLessThanOrEqual(4);
    } finally { invalidAllGroupings = false; }
  });
  it("does not multiply provider failures into smaller requests", async () => {
    const before = prompts.length; failProvider = true;
    try {
      await runChatInsights(await startChatInsights({ id: admin }), admin);
      expect((await getChatInsights()).status).toBe("error"); expect(prompts.length - before).toBe(1);
    } finally { failProvider = false; }
  });
  it("includes standalone legacy readings but never duplicates chat or resurfaces deleted conversations", async () => {
    const id = prefix + "legacy-chat";
    await db.user.create({ data: { id, email: `${id}@example.invalid`, name: "PrivateLegacyName" } });
    await db.horoscopeReading.create({ data: { userId: id, categoryId, birthProfileSnapshotJson: {}, question: "PrivateLegacyName อยากวางแผนงาน", responseText: "วางแผนงานและพัฒนาทักษะ", status: "SUCCESS" } });
    await db.horoscopeReading.create({ data: { userId: id, categoryId, birthProfileSnapshotJson: {}, idempotencyKey: prefix + "orphaned", question: "Orphan original question", responseText: "Orphan original answer", status: "SUCCESS" } });
    const conversation = await db.conversation.findFirstOrThrow({ where: { userId: prefix + "chat-0" } });
    for (const deleted of [false, true]) {
      const key = `${prefix}linked-${deleted}`;
      const existing = deleted ? null : await db.message.findFirstOrThrow({ where: { conversationId: conversation.id, role: "ASSISTANT", deletedAt: null } });
      if (existing) await db.message.update({ where: { id: existing.id }, data: { idempotencyKey: key } });
      else await db.message.create({ data: { conversationId: conversation.id, role: "ASSISTANT", content: "Hidden original answer", idempotencyKey: key, deletedAt: new Date() } });
      await db.horoscopeReading.create({ data: { userId: conversation.userId, categoryId, birthProfileSnapshotJson: {}, idempotencyKey: key, question: "Hidden original question", responseText: "Hidden original answer", status: "SUCCESS" } });
    }
    const before = prompts.length;
    await runChatInsights(await startChatInsights({ id: admin }), admin);
    const result = await getChatInsights();
    expect(result.status).toBe("ready");
    expect(result.summary).toMatchObject({ questionsAnalyzed: 4, answersAnalyzed: 4, questions: [{ count: 4 }], answers: [{ count: 4 }] });
    expect(prompts.slice(before).join(" ")).not.toContain("Hidden original");
    expect(prompts.slice(before).join(" ")).not.toContain("Orphan original");
    expect(prompts.slice(before).join(" ")).not.toContain("PrivateLegacyName");
  });
});
