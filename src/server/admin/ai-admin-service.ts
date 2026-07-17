import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import { writeAudit } from "@/server/audit/audit-service";
import { recordRevision } from "@/server/admin/content-revision-service";
import { FEATURES } from "@/config/features";
import {
  encryptSecret,
  isEncryptionConfigured,
  last4,
} from "@/lib/crypto/secret-box";
import {
  assertSafeOpenAiBaseUrl,
  isAllowedAiSecretRef,
} from "@/lib/ai-config-guards";
import { invalidateKeyCache } from "@/server/ai/secret-resolver";

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
 * knowledge docs. Every mutation writes an audit log (rule 7).
 *
 * API keys: when `apiKey` is provided on create/update it is AES-256-GCM
 * encrypted (AI_SECRET_ENC_KEY) and stored as `encryptedApiKey`. Plaintext and
 * ciphertext are never returned to the client — only `keyLast4` + `hasStoredKey`.
 * Env fallback via `secretReference` remains supported.
 */

type Actor = { id: string; ip?: string };

/** Strip secrets from audit / API payloads. */
function redactConfigSecrets<T extends Record<string, unknown>>(row: T): Omit<T, "encryptedApiKey"> & {
  encryptedApiKey?: undefined;
  hasStoredKey?: boolean;
} {
  const { encryptedApiKey, ...rest } = row as T & { encryptedApiKey?: string | null };
  return {
    ...rest,
    encryptedApiKey: undefined,
    hasStoredKey: Boolean(encryptedApiKey),
  };
}

// ---- Prompt templates -------------------------------------------------------

export type PromptCreateInput = {
  code: string;
  name: string;
  type: "SYSTEM" | "PERSONA" | "CATEGORY" | "FORMAT";
  content: string;
  enabled?: boolean;
};

export type PromptUpdateInput = Partial<Omit<PromptCreateInput, "code">>;

const promptSummarySelect = {
  id: true,
  code: true,
  name: true,
  type: true,
  enabled: true,
  version: true,
  draftUpdatedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** List metadata only — omit large content bodies (admin list views). */
export function listPromptsSummary() {
  return prisma.promptTemplate.findMany({
    orderBy: { createdAt: "asc" },
    select: promptSummarySelect,
  });
}

export function getPromptById(id: string) {
  return prisma.promptTemplate.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      content: true,
      draftContent: true,
      enabled: true,
      version: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

/** @deprecated Prefer listPromptsSummary for list UIs. */
export function listPrompts() {
  return listPromptsSummary();
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
  baseUrl?: string | null;
  secretReference?: string | null;
  /** Write-only plaintext key — encrypted before DB write. Required on create. */
  apiKey: string;
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

export type AIConfigUpdateInput = Partial<Omit<AIConfigCreateInput, "apiKey">> & {
  apiKey?: string;
};

const aiConfigListSelect = {
  id: true,
  provider: true,
  modelId: true,
  displayName: true,
  baseUrl: true,
  secretReference: true,
  keyLast4: true,
  encryptedApiKey: true, // stripped before return — used only for hasStoredKey
  enabled: true,
  temperature: true,
  maxOutputTokens: true,
  timeoutMs: true,
  fallbackConfigId: true,
  planScope: true,
  categoryId: true,
  promptTemplateId: true,
  versionLabel: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  promptTemplate: { select: { id: true, name: true } },
  fallbackConfig: { select: { id: true, displayName: true } },
} as const;

function toPublicAIConfig<T extends { encryptedApiKey?: string | null }>(row: T) {
  const { encryptedApiKey, ...rest } = row;
  return {
    ...rest,
    hasStoredKey: Boolean(encryptedApiKey),
  };
}

export async function listAIConfigs() {
  const rows = await prisma.aIProviderConfig.findMany({
    orderBy: { createdAt: "asc" },
    select: aiConfigListSelect,
  });
  return rows.map(toPublicAIConfig);
}

function buildSecretFields(apiKey: string | undefined) {
  if (!apiKey) return null;
  if (!isEncryptionConfigured()) {
    throw new AppError(
      "VALIDATION",
      "ยังไม่ได้ตั้ง AI_SECRET_ENC_KEY บนโฮสต์ — ไม่สามารถบันทึก API key ในระบบได้",
    );
  }
  return {
    encryptedApiKey: encryptSecret(apiKey),
    keyLast4: last4(apiKey),
  };
}

function normalizeSecretReference(
  provider: "GEMINI" | "OPENAI",
  secretReference: string | null | undefined,
): string | null {
  if (!secretReference) return null;
  if (!isAllowedAiSecretRef(secretReference)) {
    throw new AppError(
      "VALIDATION",
      "secretReference ต้องเป็น GEMINI_API_KEY หรือ OPENAI_API_KEY เท่านั้น",
    );
  }
  const expected = provider === "GEMINI" ? "GEMINI_API_KEY" : "OPENAI_API_KEY";
  if (secretReference !== expected) {
    throw new AppError(
      "VALIDATION",
      `${provider} ต้องใช้ env fallback ชื่อ ${expected}`,
    );
  }
  return secretReference;
}

function normalizeBaseUrlForProvider(
  provider: "GEMINI" | "OPENAI",
  baseUrl: string | null | undefined,
): string | null {
  if (provider === "GEMINI") return null;
  try {
    return assertSafeOpenAiBaseUrl(baseUrl);
  } catch (err) {
    throw new AppError(
      "VALIDATION",
      err instanceof Error ? err.message : "Base URL ไม่ถูกต้อง",
    );
  }
}

export async function createAIConfig(input: AIConfigCreateInput, actor: Actor) {
  const { apiKey, ...rest } = input;
  if (!apiKey?.trim()) {
    throw new AppError(
      "VALIDATION",
      "ต้องวาง API key เมื่อสร้างโมเดลใหม่ (ระบบจะเข้ารหัสเก็บใน DB)",
    );
  }
  const secretFields = buildSecretFields(apiKey.trim());
  if (!secretFields) {
    throw new AppError("VALIDATION", "ไม่สามารถเข้ารหัส API key ได้");
  }
  const provider = rest.provider ?? "GEMINI";

  return prisma.$transaction(async (tx) => {
    const created = await tx.aIProviderConfig.create({
      data: {
        ...rest,
        provider,
        baseUrl: normalizeBaseUrlForProvider(provider, rest.baseUrl),
        // New configs store encrypted keys only — do not keep env fallback.
        secretReference: null,
        ...secretFields,
      } as Prisma.AIProviderConfigUncheckedCreateInput,
    });
    await writeAudit(
      {
        adminUserId: actor.id,
        action: "ai_config.create",
        entityType: "ai_provider_config",
        entityId: created.id,
        after: redactConfigSecrets(created as unknown as Record<string, unknown>),
        ipAddress: actor.ip,
      },
      tx,
    );
    invalidateKeyCache(created.id);
    return toPublicAIConfig(created);
  });
}

export async function updateAIConfig(id: string, input: AIConfigUpdateInput, actor: Actor) {
  const before = await prisma.aIProviderConfig.findUnique({ where: { id } });
  if (!before) throw new AppError("NOT_FOUND", "AI config not found");
  if (input.fallbackConfigId === id) {
    throw new AppError("VALIDATION", "Fallback ต้องเป็น config ตัวอื่น");
  }

  const { apiKey, ...rest } = input;
  const secretFields = buildSecretFields(apiKey?.trim());
  const nextProvider = rest.provider ?? before.provider;
  if (rest.provider && rest.provider !== before.provider && !secretFields) {
    throw new AppError(
      "VALIDATION",
      "เมื่อเปลี่ยน Provider ต้องวาง API key ของ Provider ใหม่ด้วย",
    );
  }
  const data: Prisma.AIProviderConfigUncheckedUpdateInput = {
    ...rest,
  };
  if ("baseUrl" in rest || rest.provider) {
    data.baseUrl = normalizeBaseUrlForProvider(
      nextProvider,
      "baseUrl" in rest ? rest.baseUrl : before.baseUrl,
    );
  }
  if ("secretReference" in rest) {
    data.secretReference = normalizeSecretReference(nextProvider, rest.secretReference);
  }
  if (secretFields) {
    Object.assign(data, secretFields);
    // Replacing the key clears legacy env fallback so runtime uses DB key only.
    data.secretReference = null;
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.aIProviderConfig.update({
      where: { id },
      data,
    });
    await writeAudit(
      {
        adminUserId: actor.id,
        action: "ai_config.update",
        entityType: "ai_provider_config",
        entityId: id,
        before: redactConfigSecrets(before as unknown as Record<string, unknown>),
        after: redactConfigSecrets(updated as unknown as Record<string, unknown>),
        ipAddress: actor.ip,
      },
      tx,
    );
    invalidateKeyCache(id);
    return toPublicAIConfig(updated);
  });
}

export async function deleteAIConfig(id: string, actor: Actor) {
  const before = await prisma.aIProviderConfig.findUnique({ where: { id } });
  if (!before) throw new AppError("NOT_FOUND", "AI config not found");

  const [fallbacks] = await Promise.all([
    prisma.aIProviderConfig.count({ where: { fallbackConfigId: id } }),
  ]);
  if (fallbacks > 0) {
    throw new AppError(
      "VALIDATION",
      "Config นี้ถูกใช้งานเป็น fallback ของ config อื่น กรุณาปิดการใช้งานแทนการลบ",
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
        before: redactConfigSecrets(before as unknown as Record<string, unknown>),
        ipAddress: actor.ip,
      },
      tx,
    );
    invalidateKeyCache(id);
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

const knowledgeSummarySelect = {
  id: true,
  title: true,
  categoryId: true,
  enabled: true,
  sortOrder: true,
  draftUpdatedAt: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, nameTh: true } },
} as const;

/** List metadata only — omit large content bodies. */
export async function listKnowledgeDocsSummary() {
  // Every enabled doc is concatenated into the system prompt on each AI call, so
  // the admin needs the size. Measure it in the database rather than shipping the
  // bodies over the wire just to call .length on them.
  const [rows, sizes] = await Promise.all([
    prisma.knowledgeDoc.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: knowledgeSummarySelect,
    }),
    prisma.$queryRaw<{ id: string; chars: bigint }[]>`
      SELECT id, char_length(content) AS chars FROM knowledge_docs
    `,
  ]);

  const charsById = new Map(sizes.map((s) => [s.id, Number(s.chars)]));
  return rows.map((r) => ({ ...r, contentChars: charsById.get(r.id) ?? 0 }));
}

export async function getKnowledgeDocById(id: string) {
  const doc = await prisma.knowledgeDoc.findUnique({
    where: { id },
    include: { category: { select: { id: true, nameTh: true } } },
  });
  if (!doc) throw new AppError("NOT_FOUND", "Knowledge doc not found");
  return doc;
}

/** @deprecated Prefer listKnowledgeDocsSummary for list UIs. */
export function listKnowledgeDocs() {
  return listKnowledgeDocsSummary();
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
      snapshotJson: { title: updated.title, content: updated.content },
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
