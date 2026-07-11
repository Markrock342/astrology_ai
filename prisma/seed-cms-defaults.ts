import { PrismaClient } from "@prisma/client";
import { CMS_DEFAULTS, CMS_KEYS, type CmsKey } from "../src/lib/cms-keys";

/**
 * Idempotent: ensure every CMS key exists with defaults if missing.
 * Does NOT overwrite existing published values.
 */
export async function seedCmsDefaults(prisma: PrismaClient) {
  for (const key of Object.values(CMS_KEYS) as CmsKey[]) {
    const existing = await prisma.appSetting.findUnique({ where: { key } });
    if (existing) continue;
    await prisma.appSetting.create({
      data: {
        key,
        valueJson: CMS_DEFAULTS[key] as object,
      },
    });
  }
  console.log("CMS defaults seeded (missing keys only)");
}
