import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { MYHORA_STYLE_GLOBAL_DOCS, MYHORA_STYLE_CATEGORY_DOCS } from "../../../prisma/seed-knowledge-myhora";

const incidentStart = new Date("2026-10-18T15:38:37Z"), incidentEnd = new Date("2026-10-18T15:38:38Z");
const marker = "knowledge.recovery.20261105";
const inIncident = (date: Date) => date >= incidentStart && date < incidentEnd;
export const knowledgeBodyHash = (row: { title: string; content: string; draftTitle: string | null; draftContent: string | null }) =>
  createHash("sha256").update(JSON.stringify([row.title, row.content, row.draftTitle, row.draftContent])).digest("hex");

/** Narrow repair of the proven import incident; no content is rewritten. */
export async function recoverCuratedKnowledge(db: PrismaClient, actorId: string, backupSha256: string, apply = false) {
  if (!/^[a-f0-9]{64}$/.test(backupSha256)) throw new Error("Verified private backup SHA-256 required");
  return db.$transaction(async tx => {
    if (await tx.appSetting.findUnique({ where: { key: marker } })) return { status: "already-recovered", enabled: 0, disabled: 0 };
    const actor = await tx.user.findUniqueOrThrow({ where: { id: actorId }, select: { role: true } });
    if (actor.role !== "SUPER_ADMIN") throw new Error("Recovery requires the authorized Super Admin");
    const docs = await tx.knowledgeDoc.findMany();
    const audits = await tx.adminAuditLog.findMany({ where: { entityType: "knowledge_doc" }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { entityId: true, action: true, afterJson: true, createdAt: true } });
    const defaults = new Map(MYHORA_STYLE_GLOBAL_DOCS.map(d => [d.id, d]));
    const enable: typeof docs = [], disable: typeof docs = [];
    for (const doc of docs) {
      const changes = audits.filter(a => a.entityId === doc.id);
      const latest = changes.find(a => a.afterJson && typeof a.afterJson === "object" && !Array.isArray(a.afterJson) && typeof a.afterJson.enabled === "boolean");
      const lastEnabled = latest?.afterJson && typeof latest.afterJson === "object" && !Array.isArray(latest.afterJson) ? latest.afterJson.enabled : undefined;
      if (!doc.enabled && inIncident(doc.updatedAt) && changes.some(a => a.action === "knowledge.create") && lastEnabled === true) enable.push(doc);
      const seeded = defaults.get(doc.id) ?? (doc.id.startsWith("seed-knowledge-cat-") ? MYHORA_STYLE_CATEGORY_DOCS[doc.id.slice("seed-knowledge-cat-".length)] : undefined);
      if (doc.enabled && inIncident(doc.createdAt) && inIncident(doc.updatedAt) && !changes.some(a => a.createdAt >= doc.createdAt) && seeded?.title === doc.title && seeded.content === doc.content) disable.push(doc);
    }
    if (enable.length !== 25 || disable.length !== 9) throw new Error(`Recovery plan changed: ${enable.length} team / ${disable.length} defaults; review required`);
    if (!apply) return { status: "preview", enabled: enable.length, disabled: disable.length };
    for (const [group, enabled] of [[enable, true], [disable, false]] as const) for (const doc of group) {
      const updated = await tx.knowledgeDoc.updateMany({ where: { id: doc.id, updatedAt: doc.updatedAt, enabled: doc.enabled }, data: { enabled } });
      if (updated.count !== 1) throw new Error("Document changed during recovery; transaction rolled back");
      const after = await tx.knowledgeDoc.findUniqueOrThrow({ where: { id: doc.id } });
      if (knowledgeBodyHash(after) !== knowledgeBodyHash(doc)) throw new Error("Content changed during recovery");
      await tx.adminAuditLog.create({ data: {
        adminUserId: actorId, action: "knowledge.update", entityType: "knowledge_doc", entityId: doc.id,
        beforeJson: { enabled: doc.enabled, bodySha256: knowledgeBodyHash(doc) },
        afterJson: { enabled, bodySha256: knowledgeBodyHash(after), reason: enabled ? "ระบบกู้คืนสถานะเอกสารทีมตามคำขอเจ้าของ หลังสคริปต์นำเข้าเดิมปิดไว้" : "แยกชุดตั้งต้นที่สคริปต์เพิ่มออกจากเอกสารทีม เก็บไว้ตรวจสอบแต่ไม่ส่งให้ AI", operation: "owner-requested-maintenance-20261105", backupSha256 },
      } });
    }
    await tx.appSetting.create({ data: { key: marker, valueJson: { actorId, backupSha256, enabled: enable.map(d => d.id), disabled: disable.map(d => d.id), completedAt: new Date().toISOString() } } });
    return { status: "recovered", enabled: enable.length, disabled: disable.length };
  }, { isolationLevel: "Serializable", timeout: 20000 });
}
