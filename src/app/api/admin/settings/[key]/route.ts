import { z } from "zod";
import { handle, ok } from "@/lib/http";
import { AppError } from "@/lib/errors";
import { CMS_KEYS } from "@/lib/cms-keys";
import {
  cmsContactSchema,
  cmsDocumentSchema,
  cmsMaintenanceSchema,
  cmsPaymentInfoSchema,
  cmsSeoSchema,
  cmsTextSchema,
  settingUpdateSchema,
} from "@/lib/admin-schemas";
import { requireAdmin } from "@/server/auth/rbac";
import { publishSetting } from "@/server/admin/settings-admin-service";

const SCHEMA_BY_KEY: Record<string, z.ZodType> = {
  [CMS_KEYS.privacyPolicy]: cmsDocumentSchema,
  [CMS_KEYS.termsOfService]: cmsDocumentSchema,
  [CMS_KEYS.disclaimer]: cmsTextSchema,
  [CMS_KEYS.consentRegister]: cmsTextSchema,
  [CMS_KEYS.consentBirthPrivacy]: cmsTextSchema,
  [CMS_KEYS.consentBirthEditLimit]: cmsTextSchema,
  [CMS_KEYS.contact]: cmsContactSchema,
  [CMS_KEYS.maintenanceMode]: cmsMaintenanceSchema,
  [CMS_KEYS.paymentInfo]: cmsPaymentInfoSchema,
  [CMS_KEYS.seoHome]: cmsSeoSchema,
  [CMS_KEYS.seoPrivacy]: cmsSeoSchema,
  [CMS_KEYS.seoTerms]: cmsSeoSchema,
  [CMS_KEYS.seoDisclaimer]: cmsSeoSchema,
  [CMS_KEYS.seoFaq]: cmsSeoSchema,
};

/** PUT /api/admin/settings/:key — publish CMS content (audited). */
export async function PUT(req: Request, ctx: { params: Promise<{ key: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { key } = await ctx.params;
    const schema = SCHEMA_BY_KEY[key];
    if (!schema) throw new AppError("NOT_FOUND", "Unknown setting key");
    const { value } = settingUpdateSchema.parse(await req.json());
    const parsed = schema.parse(value);
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    return ok(await publishSetting(key, parsed, { id: admin.id, ip }));
  });
}
