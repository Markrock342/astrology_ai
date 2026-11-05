import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
const url = new URL(process.env.DATABASE_URL ?? "postgresql://invalid/invalid");
if (!["localhost", "127.0.0.1"].includes(url.hostname) || !/^\/hora_admin_filter_test(?:_[a-zA-Z0-9_-]+)?$/.test(url.pathname)) throw Error("Isolated local test DB required");
const db = new PrismaClient({ datasources: { db: { url: url.href } } });
vi.mock("@/server/db", () => ({ get prisma() { return db; } }));
const { seedKnowledgeSafely } = await import("../../prisma/seed-knowledge-safe");
const { MYHORA_STYLE_GLOBAL_DOCS, MYHORA_STYLE_CATEGORY_DOCS } = await import("../../prisma/seed-knowledge-myhora");
const { recoverCuratedKnowledge, knowledgeBodyHash } = await import("@/server/knowledge/knowledge-recovery");
const { listKnowledgeDocsSummary } = await import("@/server/admin/ai-admin-service");
const actor = "knowledge-ownership-owner", backupHash = "a".repeat(64);
let categoryId: string;
beforeAll(async () => {
  await db.user.create({ data: { id: actor, email: "knowledge-owner@example.invalid", name: "Knowledge fixture owner", role: "SUPER_ADMIN" } });
  categoryId = (await db.horoscopeCategory.create({ data: { slug: "self", nameTh: "หมวดทดสอบ" } })).id;
});
beforeEach(async () => {
  await db.knowledgeDoc.deleteMany();
  await db.adminAuditLog.deleteMany({ where: { adminUserId: actor } });
  await db.appSetting.deleteMany({ where: { key: { in: ["knowledge.initialBootstrap.v1", "knowledge.recovery.20261105"] } } });
});
afterAll(async () => {
  await db.knowledgeDoc.deleteMany();
  await db.adminAuditLog.deleteMany({ where: { adminUserId: actor } });
  await db.appSetting.deleteMany({ where: { key: { in: ["knowledge.initialBootstrap.v1", "knowledge.recovery.20261105"] } } });
  await db.horoscopeCategory.delete({ where: { id: categoryId } });
  await db.user.delete({ where: { id: actor } }); await db.$disconnect();
});
async function incident() {
  const time = new Date("2026-10-18T15:38:37.800Z"), before = new Date("2026-09-14T05:00Z");
  for (let i = 0; i < 25; i++) {
    const doc = await db.knowledgeDoc.create({ data: { id: `fixture-authored-${i}`, title: `เอกสารทีม ${i}`, content: `ตำราทีมงานที่ไม่ควรถูกเขียนทับ ${i}`, enabled: false, createdAt: before, updatedAt: time } });
    await db.adminAuditLog.create({ data: { adminUserId: actor, action: "knowledge.create", entityType: "knowledge_doc", entityId: doc.id, afterJson: { enabled: true }, createdAt: before } });
  }
  for (const doc of MYHORA_STYLE_GLOBAL_DOCS) {
    await db.knowledgeDoc.create({ data: { id: doc.id, title: doc.title, content: doc.content, sortOrder: doc.sortOrder, enabled: true, createdAt: time, updatedAt: time } });
    await db.adminAuditLog.create({ data: { adminUserId: actor, action: "knowledge.delete", entityType: "knowledge_doc", entityId: doc.id, createdAt: before } });
  }
  await db.knowledgeDoc.create({ data: { id: "seed-knowledge-cat-self", ...MYHORA_STYLE_CATEGORY_DOCS.self, categoryId, sortOrder: 10, enabled: true, createdAt: time, updatedAt: time } });
  await db.knowledgeDoc.create({ data: { id: "kb-team-engine-formulas", title: "คู่มือทีม", content: "ไม่ส่งเข้า AI", enabled: false } });
}
describe("curated knowledge ownership and incident recovery", () => {
  it("previews an empty library without mutation and bootstraps only once", async () => {
    expect((await seedKnowledgeSafely(db)).status).toBe("preview"); expect(await db.knowledgeDoc.count()).toBe(0);
    expect((await seedKnowledgeSafely(db, true)).created).toBe(9);
    const doc = await db.knowledgeDoc.findFirstOrThrow();
    await db.knowledgeDoc.update({ where: { id: doc.id }, data: { content: "Edited by owner", enabled: false } });
    const before = await db.knowledgeDoc.findMany({ orderBy: { id: "asc" } });
    expect((await seedKnowledgeSafely(db, true)).status).toBe("preserved");
    expect(await db.knowledgeDoc.findMany({ orderBy: { id: "asc" } })).toEqual(before);
    await db.knowledgeDoc.deleteMany(); expect((await seedKnowledgeSafely(db, true)).created).toBe(0);
    expect(await db.knowledgeDoc.count()).toBe(0);
  });
  it("preserves curated documents and respects intentional deletion even in an empty library", async () => {
    const doc = await db.knowledgeDoc.create({ data: { title: "Team content", content: "Original", enabled: false } });
    expect((await seedKnowledgeSafely(db, true)).status).toBe("preserved");
    expect(await db.knowledgeDoc.findUnique({ where: { id: doc.id } })).toEqual(doc);
    await db.knowledgeDoc.deleteMany();
    await db.adminAuditLog.create({ data: { adminUserId: actor, entityType: "knowledge_doc", entityId: "kb-global-planets", action: "knowledge.delete" } });
    expect((await seedKnowledgeSafely(db, true)).status).toBe("preserved"); expect(await db.knowledgeDoc.count()).toBe(0);
  });
  it("listing is read-only and never recreates a deleted system guide", async () => {
    expect(await listKnowledgeDocsSummary()).toEqual([]); expect(await db.knowledgeDoc.count()).toBe(0);
    await db.knowledgeDoc.create({ data: { id: "kb-team-engine-formulas", title: "Guide", content: "Reference", enabled: false } });
    expect((await listKnowledgeDocsSummary())[0].provenance?.source).toBe("SYSTEM_GUIDE");
    await db.knowledgeDoc.deleteMany(); await listKnowledgeDocsSummary(); expect(await db.knowledgeDoc.count()).toBe(0);
  });
  it("repairs only the proven incident, preserves every body/draft, audits all changes and is idempotent", async () => {
    await incident();
    const before = await db.knowledgeDoc.findMany({ orderBy: { id: "asc" } });
    expect(await recoverCuratedKnowledge(db, actor, backupHash)).toMatchObject({ status: "preview", enabled: 25, disabled: 9 });
    expect(await db.knowledgeDoc.findMany({ orderBy: { id: "asc" } })).toEqual(before);
    expect(await recoverCuratedKnowledge(db, actor, backupHash, true)).toMatchObject({ status: "recovered", enabled: 25, disabled: 9 });
    const after = await db.knowledgeDoc.findMany({ orderBy: { id: "asc" } });
    expect(after.map(knowledgeBodyHash)).toEqual(before.map(knowledgeBodyHash));
    expect(after.filter(d => d.enabled)).toHaveLength(25);
    expect(after.find(d => d.id === "kb-team-engine-formulas")?.enabled).toBe(false);
    const summaries = await listKnowledgeDocsSummary();
    expect(summaries.filter(d => d.provenance?.source === "TEAM")).toHaveLength(25);
    expect(summaries.filter(d => d.provenance?.source === "DEFAULT")).toHaveLength(9);
    expect(summaries.find(d => d.id === "fixture-authored-0")?.provenance).toMatchObject({ statusChangedBy: "Knowledge fixture owner" });
    expect(await db.adminAuditLog.count({ where: { action: "knowledge.update" } })).toBe(34);
    expect((await recoverCuratedKnowledge(db, actor, backupHash, true)).status).toBe("already-recovered");
  });
  it("does not blame a past recorded state change for a later unlogged change", async () => {
    await incident();
    const summary = (await listKnowledgeDocsSummary()).find(d => d.id === "fixture-authored-0")!;
    expect(summary.enabled).toBe(false); expect(summary.provenance?.statusChangedAt).toBeNull(); expect(summary.provenance?.statusChangedBy).toBeNull();
  });
  it("refuses recovery if the owner changed a document after the incident", async () => {
    await incident();
    await db.knowledgeDoc.update({ where: { id: "fixture-authored-0" }, data: { title: "New intentional owner edit" } });
    await expect(recoverCuratedKnowledge(db, actor, backupHash, true)).rejects.toThrow("Recovery plan changed");
    expect(await db.knowledgeDoc.count({ where: { id: { startsWith: "fixture-authored-" }, enabled: true } })).toBe(0);
    expect(await db.adminAuditLog.count({ where: { action: "knowledge.update" } })).toBe(0);
  });
});
