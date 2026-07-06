import type { CmsKey } from "@/lib/cms-keys";
import { CMS_DEFAULTS } from "@/lib/cms-keys";
import { AppError } from "@/lib/errors";
import { writeAudit } from "@/server/audit/audit-service";
import { listAllSettings, upsertSetting } from "@/server/settings/settings-service";

type Actor = { id: string; ip?: string };

export function listSettingsAdmin() {
  return listAllSettings();
}

export async function updateSetting(key: string, value: unknown, actor: Actor) {
  if (!(key in CMS_DEFAULTS)) {
    throw new AppError("VALIDATION", `Unknown setting key: ${key}`);
  }

  const cmsKey = key as CmsKey;
  const beforeRow = await listAllSettings().then((rows) => rows.find((r) => r.key === cmsKey));

  const updated = await upsertSetting(cmsKey, value);

  await writeAudit({
    adminUserId: actor.id,
    action: "setting.update",
    entityType: "app_setting",
    entityId: key,
    before: beforeRow?.value,
    after: value,
    ipAddress: actor.ip,
  });

  return { key: updated.key, value: updated.valueJson, updatedAt: updated.updatedAt };
}
