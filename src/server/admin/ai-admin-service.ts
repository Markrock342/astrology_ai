import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import { writeAudit } from "@/server/audit/audit-service";
import { recordRevision } from "@/server/admin/content-revision-service";
import { FEATURES } from "@/config/features";

/**
 * Guard the AI CMS behind the current phase (defense in depth — the UI is also
 * hidden). Call at the top of every AI-admin API route.
 */
export function assertAiAdminEnabled() {
  if (!FEATURES.aiAdmin) {
    throw new AppError("FEATURE_DISABLED", "โมดูลจัดการ AI จะเปิดใช้งานในเฟสถัดไป");
  }
}

/**
 * Admin AI CMS service: CRUD for prompt templates, AI provider configs, and
 * knowledge docs. Every mutation writes an audit log (rule 7). API keys are
 * NEVER stored here — configs hold only the env var NAME (secretReference).
 */

type Actor = { id: string; ip?: string };

// ---- Prompt templates -------------------------------------------------------

export type PromptCreateInput = {
  code: string;
  name: string;
  type: "SYSTEM" | "PERSONA" | "CATEGORY" | "FORMAT";
  content: string;
  enabled?: boolean;
};

export type PromptUpdateInput = Partial<Omit<PromptCreateInput, "code">>;

export function listPrompts() {
  return prisma.promptTemplate.findMany({ orderBy: { createdAt: "asc" } });
}

export async function createPrompt(input: PromptCreateInput, actor: Actor) {
  return prisma.$transaction(async (tx) => {
    const created = await tx.promptTemplate.create({
      data: { ...input, enabled: input.enabled ?? true },
    });
    await writeAudit(
      {
        adminUserId: actor.id,
        action: "prompt.create",
        entityType: "prompt_template",
        entityId: created.id,
        after: created,
        ipAddress: actor.ip,
      },
      tx,
    );
    return created;
  });
}

export async function updatePrompt(id: string, input: PromptUpdateInput, actor: Actor) {
  // Direct update = publish (backward compatible with existing admin UI calls).
  if (input.content !== undefined) {
    return publishPrompt(id, { ...input, content: input.content }, actor);
  }
  return updatePromptMeta(id, input, actor);
}

async function updatePromptMeta(id: string, input: PromptUpdateInput, actor: Actor) {
  const before = await prisma.promptTemplate.findUnique({ where: { id } });
  if (!before) throw new AppError("NOT_FOUND", "Prompt template not found");

  return prisma.$transaction(async (tx) => {
    const updated = await tx.promptTemplate.update({
      where: { id },
      data: input,
    });
    await writeAudit(
      {
        adminUserId: actor.id,
        action: "prompt.update",
        entityType: "prompt_template",
        entityId: id,
        before,
        after: updated,
        ipAddress: actor.ip,
      },
      tx,
    );
    return updated;
  });
}

export async function savePromptDraft(
  id: string,
  input: { content: string; name?: string; type?: PromptCreateInput["type"]; enabled?: boolean },
  actor: Actor,
) {
  const before = await prisma.promptTemplate.findUnique({ where: { id } });
  if (!before) throw new AppError("NOT_FOUND", "Prompt template not found");

  const updated = await prisma.promptTemplate.update({
    where: { id },
    data: {
      draftContent: input.content,
      draftUpdatedAt: new Date(),
      draftUpdatedById: actor.id,
    },
  });

  await recordRevision({
    entityType: "PROMPT_TEMPLATE",
    entityId: id,
    snapshotJson: {
      content: input.content,
      name: input.name ?? before.name,
      type: input.type ?? before.type,
      enabled: input.enabled ?? before.enabled,
    },
    action: "DRAFT_SAVE",
    actor,
  });

  return updated;
}

export async function publishPrompt(
  id: string,
  input: PromptUpdateInput & { content: string },
  actor: Actor,
) {
  const before = await prisma.promptTemplate.findUnique({ where: { id } });
  if (!before) throw new AppError("NOT_FOUND", "Prompt template not found");

  const contentChanged = input.content !== before.content;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.promptTemplate.update({
      where: { id },
      data: {
        ...input,
        ...(contentChanged ? { version: { increment: 1 } } : {}),
        draftContent: null,
        draftUpdatedAt: null,
        draftUpdatedById: null,
      },
    });
    await recordRevision({
      entityType: "PROMPT_TEMPLATE",
      entityId: id,
      snapshotJson: {
        content: updated.content,
        name: updated.name,
        type: updated.type,
        enabled: updated.enabled,
        version: updated.version,
      },
      action: "PUBLISH",
      actor,
    });
    await writeAudit(
      {
        adminUserId: actor.id,
        action: "prompt.publish",
        entityType: "prompt_template",
        entityId: id,
        before,
        after: updated,
        ipAddress: actor.ip,
      },
      tx,
    );
    return updated;
  });
}

export async function restorePromptRevision(
  id: string,
  revisionId: string,
  actor: Actor,
  mode: "draft" | "publish" = "draft",
) {
  const { getRevision } = await import("@/server/admin/content-revision-service");
  const revision = await getRevision(revisionId);
  if (!revision || revision.entityType !== "PROMPT_TEMPLATE" || revision.entityId !== id) {
    throw new AppError("NOT_FOUND", "Revision not found");
  }
  const snap = revision.snapshotJson as { content: string; name?: string; type?: PromptCreateInput["type"]; enabled?: boolean };
  await recordRevision({
    entityType: "PROMPT_TEMPLATE",
    entityId: id,
    snapshotJson: snap,
    action: "RESTORE",
    actor,
    note: `from v${revision.version}`,
  });
  if (mode === "publish") {
    return publishPrompt(
      id,
      {
        name: snap.name,
        type: snap.type,
        enabled: snap.enabled,
        content: snap.content,
      },
      actor,
    );
  }
  return savePromptDraft(
    id,
    {
      content: snap.content,
      name: snap.name,
      type: snap.type,
      enabled: snap.enabled,
    },
    actor,
  );
}

export async function deletePrompt(id: string, actor: Actor) {
  const before = await prisma.promptTemplate.findUnique({ where: { id } });
  if (!before) throw new AppError("NOT_FOUND", "Prompt template not found");

  const [cats, configs] = await Promise.all([
    prisma.horoscopeCategory.count({ where: { promptTemplateId: id } }),
    prisma.aIProviderConfig.count({ where: { promptTemplateId: id } }),
  ]);
  if (cats > 0 || configs > 0) {
    throw new AppError(
      "VALIDATION",
      "Prompt นี้ถูกใช้งานอยู่ (หมวดหมู่/AI config) กรุณาปิดการใช้งานแทนการลบ",
    );
  }

  return prisma.$transaction(async (tx) => {
    await tx.promptTemplate.delete({ where: { id } });
    await writeAudit(
      {
        adminUserId: actor.id,
        action: "prompt.delete",
        entityType: "prompt_template",
        entityId: id,
        before,
        ipAddress: actor.ip,
      },
      tx,
    );
    return { id };
  });
}

// ---- AI provider configs ----------------------------------------------------

export type AIConfigCreateInput = {
  provider: "GEMINI" | "OPENAI";
  modelId: string;
  displayName: string;
  secretReference: string;
  enabled?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  fallbackConfigId?: string | null;
  planScope?: "FREE" | "PRO" | "ALL";
  categoryId?: string | null;
  promptTemplateId?: string | null;
  versionLabel?: string;
  notes?: string;
};

export type AIConfigUpdateInput = Partial<AIConfigCreateInput>;

export function listAIConfigs() {
  return prisma.aIProviderConfig.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      promptTemplate: { select: { id: true, name: true } },
      fallbackConfig: { select: { id: true, displayName: true } },
    },
  });
}

export async function createAIConfig(input: AIConfigCreateInput, actor: Actor) {
  return prisma.$transaction(async (tx) => {
    const created = await tx.aIProviderConfig.create({
      data: input as Prisma.AIProviderConfigUncheckedCreateInput,
    });
    await writeAudit(
      {
        adminUserId: actor.id,
        action: "ai_config.create",
        entityType: "ai_provider_config",
        entityId: created.id,
        after: created,
        ipAddress: actor.ip,
      },
      tx,
    );
    return created;
  });
}

export async function updateAIConfig(id: string, input: AIConfigUpdateInput, actor: Actor) {
  const before = await prisma.aIProviderConfig.findUnique({ where: { id } });
  if (!before) throw new AppError("NOT_FOUND", "AI config not found");
  if (input.fallbackConfigId === id) {
    throw new AppError("VALIDATION", "Fallback ต้องเป็น config ตัวอื่น");
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.aIProviderConfig.update({
      where: { id },
      data: input as Prisma.AIProviderConfigUncheckedUpdateInput,
    });
    await writeAudit(
      {
        adminUserId: actor.id,
        action: "ai_config.update",
        entityType: "ai_provider_config",
        entityId: id,
        before,
        after: updated,
        ipAddress: actor.ip,
      },
      tx,
    );
    return updated;
  });
}

export async function deleteAIConfig(id: string, actor: Actor) {
  const before = await prisma.aIProviderConfig.findUnique({ where: { id } });
  if (!before) throw new AppError("NOT_FOUND", "AI config not found");

  const [cats, fallbacks] = await Promise.all([
    prisma.horoscopeCategory.count({ where: { aiConfigId: id } }),
    prisma.aIProviderConfig.count({ where: { fallbackConfigId: id } }),
  ]);
  if (cats > 0 || fallbacks > 0) {
    throw new AppError(
      "VALIDATION",
      "Config นี้ถูกใช้งานอยู่ (หมวดหมู่/fallback) กรุณาปิดการใช้งานแทนการลบ",
    );
  }

  return prisma.$transaction(async (tx) => {
    await tx.aIProviderConfig.delete({ where: { id } });
    await writeAudit(
      {
        adminUserId: actor.id,
        action: "ai_config.delete",
        entityType: "ai_provider_config",
        entityId: id,
        before,
        ipAddress: actor.ip,
      },
      tx,
    );
    return { id };
  });
}

// ---- Knowledge docs ---------------------------------------------------------

export type KnowledgeCreateInput = {
  title: string;
  content: string;
  categoryId?: string | null;
  enabled?: boolean;
  sortOrder?: number;
};

export type KnowledgeUpdateInput = Partial<KnowledgeCreateInput>;

export function listKnowledgeDocs() {
  return prisma.knowledgeDoc.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { category: { select: { id: true, nameTh: true } } },
  });
}

export async function createKnowledgeDoc(input: KnowledgeCreateInput, actor: Actor) {
  return prisma.$transaction(async (tx) => {
    const created = await tx.knowledgeDoc.create({
      data: input as Prisma.KnowledgeDocUncheckedCreateInput,
    });
    await writeAudit(
      {
        adminUserId: actor.id,
        action: "knowledge.create",
        entityType: "knowledge_doc",
        entityId: created.id,
        after: { ...created, content: created.content.slice(0, 500) },
        ipAddress: actor.ip,
      },
      tx,
    );
    return created;
  });
}

export async function updateKnowledgeDoc(id: string, input: KnowledgeUpdateInput, actor: Actor) {
  const before = await prisma.knowledgeDoc.findUnique({ where: { id } });
  if (!before) throw new AppError("NOT_FOUND", "Knowledge doc not found");

  if (input.content !== undefined || input.title !== undefined) {
    return publishKnowledgeDoc(
      id,
      {
        title: input.title ?? before.title,
        content: input.content ?? before.content,
        categoryId: input.categoryId ?? before.categoryId,
        enabled: input.enabled ?? before.enabled,
        sortOrder: input.sortOrder ?? before.sortOrder,
      },
      actor,
    );
  }
  return updateKnowledgeMeta(id, input, actor);
}

async function updateKnowledgeMeta(id: string, input: KnowledgeUpdateInput, actor: Actor) {
  const before = await prisma.knowledgeDoc.findUnique({ where: { id } });
  if (!before) throw new AppError("NOT_FOUND", "Knowledge doc not found");

  return prisma.$transaction(async (tx) => {
    const updated = await tx.knowledgeDoc.update({
      where: { id },
      data: input as Prisma.KnowledgeDocUncheckedUpdateInput,
    });
    await writeAudit(
      {
        adminUserId: actor.id,
        action: "knowledge.update",
        entityType: "knowledge_doc",
        entityId: id,
        before: { ...before, content: before.content.slice(0, 500) },
        after: { ...updated, content: updated.content.slice(0, 500) },
        ipAddress: actor.ip,
      },
      tx,
    );
    return updated;
  });
}

export async function saveKnowledgeDraft(
  id: string,
  input: { title: string; content: string },
  actor: Actor,
) {
  const before = await prisma.knowledgeDoc.findUnique({ where: { id } });
  if (!before) throw new AppError("NOT_FOUND", "Knowledge doc not found");

  const updated = await prisma.knowledgeDoc.update({
    where: { id },
    data: {
      draftTitle: input.title,
      draftContent: input.content,
      draftUpdatedAt: new Date(),
      draftUpdatedById: actor.id,
    },
  });

  await recordRevision({
    entityType: "KNOWLEDGE_DOC",
    entityId: id,
    snapshotJson: input,
    action: "DRAFT_SAVE",
    actor,
  });

  return updated;
}

export async function publishKnowledgeDoc(id: string, input: KnowledgeCreateInput, actor: Actor) {
  const before = await prisma.knowledgeDoc.findUnique({ where: { id } });
  if (!before) throw new AppError("NOT_FOUND", "Knowledge doc not found");

  return prisma.$transaction(async (tx) => {
    const updated = await tx.knowledgeDoc.update({
      where: { id },
      data: {
        ...input,
        draftTitle: null,
        draftContent: null,
        draftUpdatedAt: null,
        draftUpdatedById: null,
      } as Prisma.KnowledgeDocUncheckedUpdateInput,
    });
    await recordRevision({
      entityType: "KNOWLEDGE_DOC",
      entityId: id,
      snapshotJson: { title: updated.title, content: updated.content.slice(0, 2000) },
      action: "PUBLISH",
      actor,
    });
    await writeAudit(
      {
        adminUserId: actor.id,
        action: "knowledge.publish",
        entityType: "knowledge_doc",
        entityId: id,
        before: { ...before, content: before.content.slice(0, 500) },
        after: { ...updated, content: updated.content.slice(0, 500) },
        ipAddress: actor.ip,
      },
      tx,
    );
    return updated;
  });
}

export async function restoreKnowledgeRevision(
  id: string,
  revisionId: string,
  actor: Actor,
  mode: "draft" | "publish" = "draft",
) {
  const { getRevision } = await import("@/server/admin/content-revision-service");
  const revision = await getRevision(revisionId);
  if (!revision || revision.entityType !== "KNOWLEDGE_DOC" || revision.entityId !== id) {
    throw new AppError("NOT_FOUND", "Revision not found");
  }
  const snap = revision.snapshotJson as { title: string; content: string };
  await recordRevision({
    entityType: "KNOWLEDGE_DOC",
    entityId: id,
    snapshotJson: snap,
    action: "RESTORE",
    actor,
    note: `from v${revision.version}`,
  });
  if (mode === "publish") return publishKnowledgeDoc(id, snap, actor);
  return saveKnowledgeDraft(id, snap, actor);
}

export async function deleteKnowledgeDoc(id: string, actor: Actor) {
  const before = await prisma.knowledgeDoc.findUnique({ where: { id } });
  if (!before) throw new AppError("NOT_FOUND", "Knowledge doc not found");

  return prisma.$transaction(async (tx) => {
    await tx.knowledgeDoc.delete({ where: { id } });
    await writeAudit(
      {
        adminUserId: actor.id,
        action: "knowledge.delete",
        entityType: "knowledge_doc",
        entityId: id,
        before: { ...before, content: before.content.slice(0, 500) },
        ipAddress: actor.ip,
      },
      tx,
    );
    return { id };
  });
}
