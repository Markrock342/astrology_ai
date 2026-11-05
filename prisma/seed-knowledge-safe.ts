import type { PrismaClient } from "@prisma/client";
import { MYHORA_STYLE_GLOBAL_DOCS, MYHORA_STYLE_CATEGORY_DOCS } from "./seed-knowledge-myhora";

/** Initial bootstrap only. An established/curated library is never reconciled. */
export async function seedKnowledgeSafely(prisma: PrismaClient, apply = false) {
  return prisma.$transaction(async tx => {
    const [count, history, marker] = await Promise.all([
      tx.knowledgeDoc.count(),
      tx.adminAuditLog.count({ where: { entityType: "knowledge_doc" } }),
      tx.appSetting.findUnique({ where: { key: "knowledge.initialBootstrap.v1" }, select: { key: true } }),
    ]);
    if (count || history || marker) return { status: "preserved" as const, existing: count, created: 0 };
    const categories = await tx.horoscopeCategory.findMany({ select: { id: true, slug: true } });
    const data = [
      ...MYHORA_STYLE_GLOBAL_DOCS.map(doc => ({ id: doc.id, title: doc.title, content: doc.content, sortOrder: doc.sortOrder, categoryId: null, enabled: true })),
      ...categories.flatMap(cat => {
        const doc = MYHORA_STYLE_CATEGORY_DOCS[cat.slug];
        return doc ? [{ id: `seed-knowledge-cat-${cat.slug}`, title: doc.title, content: doc.content, categoryId: cat.id, sortOrder: 10, enabled: true }] : [];
      }),
    ];
    if (!apply) return { status: "preview" as const, existing: 0, created: 0, candidates: data.length };
    const result = await tx.knowledgeDoc.createMany({ data, skipDuplicates: true });
    await tx.appSetting.create({ data: { key: "knowledge.initialBootstrap.v1", valueJson: { createdAt: new Date().toISOString(), documentIds: data.map(d => d.id), source: "initial-bootstrap" } } });
    return { status: "created" as const, existing: 0, created: result.count };
  }, { isolationLevel: "Serializable" });
}
