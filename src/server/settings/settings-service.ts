import { prisma } from "@/server/db";
import {
  CMS_DEFAULTS,
  CMS_KEYS,
  PUBLIC_CMS_KEYS,
  type CmsContact,
  type CmsDocument,
  type CmsKey,
  type CmsMaintenance,
  type CmsPaymentInfo,
  type CmsText,
} from "@/lib/cms-keys";

/** Read a CMS value — DB row wins, else baked-in default. */
export async function getSetting<K extends CmsKey>(key: K): Promise<(typeof CMS_DEFAULTS)[K]> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  if (row?.valueJson != null) {
    return row.valueJson as (typeof CMS_DEFAULTS)[K];
  }
  return CMS_DEFAULTS[key];
}

export async function getPublicSettings() {
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: PUBLIC_CMS_KEYS } },
  });
  const dbMap = Object.fromEntries(rows.map((r) => [r.key, r.valueJson]));
  const out: Record<string, unknown> = {};
  for (const key of PUBLIC_CMS_KEYS) {
    out[key] = dbMap[key] ?? CMS_DEFAULTS[key];
  }
  return out;
}

export async function listAllSettings() {
  const rows = await prisma.appSetting.findMany({ orderBy: { key: "asc" } });
  const dbMap = Object.fromEntries(rows.map((r) => [r.key, r]));
  return (Object.keys(CMS_DEFAULTS) as CmsKey[]).map((key) => ({
    key,
    value: dbMap[key]?.valueJson ?? CMS_DEFAULTS[key],
    updatedAt: dbMap[key]?.updatedAt ?? null,
    isDefault: !dbMap[key],
  }));
}

export async function upsertSetting(key: CmsKey, value: unknown) {
  return prisma.appSetting.upsert({
    where: { key },
    create: { key, valueJson: value as object },
    update: { valueJson: value as object },
  });
}

/** Typed helpers for common pages. */
export async function getPrivacyDocument(): Promise<CmsDocument> {
  return getSetting(CMS_KEYS.privacyPolicy) as Promise<CmsDocument>;
}

export async function getTermsDocument(): Promise<CmsDocument> {
  return getSetting(CMS_KEYS.termsOfService) as Promise<CmsDocument>;
}

export async function getDisclaimerText(): Promise<CmsText> {
  return getSetting(CMS_KEYS.disclaimer) as Promise<CmsText>;
}

export async function getMaintenanceMode(): Promise<CmsMaintenance> {
  return getSetting(CMS_KEYS.maintenanceMode) as Promise<CmsMaintenance>;
}

export async function getPaymentInfo(): Promise<CmsPaymentInfo> {
  return getSetting(CMS_KEYS.paymentInfo) as Promise<CmsPaymentInfo>;
}

export async function getContactInfo(): Promise<CmsContact> {
  return getSetting(CMS_KEYS.contact) as Promise<CmsContact>;
}

export async function getConsentTexts() {
  const [register, birthPrivacy, birthEditLimit] = await Promise.all([
    getSetting(CMS_KEYS.consentRegister) as Promise<CmsText>,
    getSetting(CMS_KEYS.consentBirthPrivacy) as Promise<CmsText>,
    getSetting(CMS_KEYS.consentBirthEditLimit) as Promise<CmsText>,
  ]);
  return { register, birthPrivacy, birthEditLimit };
}
