import type { CmsKey } from "@/lib/cms-keys";
import { CMS_DEFAULTS } from "@/lib/cms-keys";
import { AppError } from "@/lib/errors";
import { writeAudit } from "@/server/audit/audit-service";
import {
  listAllSettings,
  upsertSetting,
  getPublishedSetting,
} from "@/server/settings/settings-service";
import { recordRevision } from "@/server/admin/content-revision-service";

type Actor = { id: string; ip?: string };

export function listSettingsAdmin() {
  return listAllSettings();
}

/** Legacy direct publish — kept for backward compatibility. */
export async function updateSetting(key: string, value: unknown, actor: Actor) {
  return publishSetting(key, value, actor);
}

export async function saveSettingDraft(key: string, value: unknown, actor: Actor) {
  if (!(key in CMS_DEFAULTS)) {
    throw new AppError("VALIDATION", `Unknown setting key: ${key}`);
  }
  const cmsKey = key as CmsKey;
  const published = await getPublishedSetting(cmsKey);

  const updated = await upsertSetting(cmsKey, published, {
    draftValueJson: value,
    draftUpdatedAt: new Date(),
    draftUpdatedById: actor.id,
  });

  await recordRevision({
    entityType: "APP_SETTING",
    entityId: key,
    snapshotJson: value,
    action: "DRAFT_SAVE",
    actor,
  });

  await writeAudit({
    adminUserId: actor.id,
    action: "setting.draft",
    entityType: "app_setting",
    entityId: key,
    after: value,
    ipAddress: actor.ip,
  });

  return formatSettingRow(cmsKey, updated);
}

export async function publishSetting(key: string, value: unknown, actor: Actor) {
  if (!(key in CMS_DEFAULTS)) {
    throw new AppError("VALIDATION", `Unknown setting key: ${key}`);
  }
  const cmsKey = key as CmsKey;
  const beforeRow = await listAllSettings().then((rows) => rows.find((r) => r.key === cmsKey));
  const beforePublished = beforeRow?.published ?? CMS_DEFAULTS[cmsKey];

  const updated = await upsertSetting(cmsKey, value, {
    draftValueJson: null,
    draftUpdatedAt: null,
    draftUpdatedById: null,
  });

  await recordRevision({
    entityType: "APP_SETTING",
    entityId: key,
    snapshotJson: value,
    action: "PUBLISH",
    actor,
  });

  await writeAudit({
    adminUserId: actor.id,
    action: "setting.publish",
    entityType: "app_setting",
    entityId: key,
    before: beforePublished,
    after: value,
    ipAddress: actor.ip,
  });

  return formatSettingRow(cmsKey, updated);
}

export async function discardSettingDraft(key: string, actor: Actor) {
  if (!(key in CMS_DEFAULTS)) {
    throw new AppError("VALIDATION", `Unknown setting key: ${key}`);
  }
  const cmsKey = key as CmsKey;
  const published = await getPublishedSetting(cmsKey);
  const updated = await upsertSetting(cmsKey, published, {
    draftValueJson: null,
    draftUpdatedAt: null,
    draftUpdatedById: null,
  });
  await writeAudit({
    adminUserId: actor.id,
    action: "setting.discard_draft",
    entityType: "app_setting",
    entityId: key,
    ipAddress: actor.ip,
  });
  return formatSettingRow(cmsKey, updated);
}

export async function restoreSettingRevision(
  key: string,
  revisionId: string,
  actor: Actor,
  mode: "draft" | "publish" = "draft",
) {
  const { getRevision } = await import("@/server/admin/content-revision-service");
  const revision = await getRevision(revisionId);
  if (!revision || revision.entityType !== "APP_SETTING" || revision.entityId !== key) {
    throw new AppError("NOT_FOUND", "Revision not found");
  }

  await recordRevision({
    entityType: "APP_SETTING",
    entityId: key,
    snapshotJson: revision.snapshotJson,
    action: "RESTORE",
    actor,
    note: `from v${revision.version}`,
  });

  if (mode === "publish") {
    return publishSetting(key, revision.snapshotJson, actor);
  }
  return saveSettingDraft(key, revision.snapshotJson, actor);
}

function formatSettingRow(
  key: CmsKey,
  row: {
    key: string;
    valueJson: unknown;
    draftValueJson: unknown;
    draftUpdatedAt: Date | null;
    updatedAt: Date;
  },
) {
  return {
    key,
    published: row.valueJson,
    draft: row.draftValueJson ?? null,
    hasDraft: row.draftValueJson != null,
    value: row.valueJson,
    updatedAt: row.updatedAt,
    draftUpdatedAt: row.draftUpdatedAt,
    isDefault: false,
  };
}
