import { unstable_cache } from "next/cache";
import { prisma } from "@/server/db";
import { Prisma } from "@prisma/client";
import {
  CMS_DEFAULTS,
  CMS_KEYS,
  PUBLIC_CMS_KEYS,
  type CmsContact,
  type CmsDocument,
  type CmsKey,
  type CmsMaintenance,
  type CmsPaymentInfo,
  type CmsSeo,
  type CmsText,
} from "@/lib/cms-keys";

type SettingRow = {
  key: string;
  valueJson: unknown;
  draftValueJson?: unknown | null;
  draftUpdatedAt?: Date | null;
  draftUpdatedById?: string | null;
  updatedAt: Date;
};

/** Read published CMS value — DB row wins, else baked-in default. */
export async function getPublishedSetting<K extends CmsKey>(
  key: K,
): Promise<(typeof CMS_DEFAULTS)[K]> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  if (row?.valueJson != null) {
    return row.valueJson as (typeof CMS_DEFAULTS)[K];
  }
  return CMS_DEFAULTS[key];
}

/** Backward-compatible alias. */
export async function getSetting<K extends CmsKey>(key: K): Promise<(typeof CMS_DEFAULTS)[K]> {
  return getPublishedSetting(key);
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
  return (Object.keys(CMS_DEFAULTS) as CmsKey[]).map((key) => {
    const row = dbMap[key] as SettingRow | undefined;
    const published = row?.valueJson ?? CMS_DEFAULTS[key];
    return {
      key,
      published,
      draft: row?.draftValueJson ?? null,
      hasDraft: row?.draftValueJson != null,
      value: published,
      updatedAt: row?.updatedAt ?? null,
      draftUpdatedAt: row?.draftUpdatedAt ?? null,
      isDefault: !row,
    };
  });
}

export async function upsertSetting(
  key: CmsKey,
  publishedValue: unknown,
  draft?: {
    draftValueJson?: unknown | null;
    draftUpdatedAt?: Date | null;
    draftUpdatedById?: string | null;
  },
) {
  const existing = await prisma.appSetting.findUnique({ where: { key } });
  if (existing) {
    return prisma.appSetting.update({
      where: { key },
      data: {
        valueJson: publishedValue as Prisma.InputJsonValue,
        ...(draft
          ? {
              draftValueJson:
                draft.draftValueJson === undefined
                  ? undefined
                  : draft.draftValueJson === null
                    ? Prisma.JsonNull
                    : (draft.draftValueJson as Prisma.InputJsonValue),
              draftUpdatedAt: draft.draftUpdatedAt,
              draftUpdatedById: draft.draftUpdatedById,
            }
          : {}),
      },
    });
  }
  return prisma.appSetting.create({
    data: {
      key,
      valueJson: publishedValue as Prisma.InputJsonValue,
      draftValueJson:
        draft?.draftValueJson === undefined
          ? undefined
          : draft.draftValueJson === null
            ? Prisma.JsonNull
            : (draft.draftValueJson as Prisma.InputJsonValue),
      draftUpdatedAt: draft?.draftUpdatedAt ?? undefined,
      draftUpdatedById: draft?.draftUpdatedById ?? undefined,
    },
  });
}

export async function getDraftSetting<K extends CmsKey>(key: K) {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  if (row?.draftValueJson != null) {
    return row.draftValueJson as (typeof CMS_DEFAULTS)[K];
  }
  return getPublishedSetting(key);
}

const SEO_BY_PATH: Record<string, CmsKey> = {
  "/": CMS_KEYS.seoHome,
  "/privacy": CMS_KEYS.seoPrivacy,
  "/terms": CMS_KEYS.seoTerms,
  "/disclaimer": CMS_KEYS.seoDisclaimer,
  "/help": CMS_KEYS.seoFaq,
};

export async function getSeoForPath(path: string): Promise<CmsSeo | null> {
  const key = SEO_BY_PATH[path];
  if (!key) return null;
  return getPublishedSetting(key) as Promise<CmsSeo>;
}

/** Typed helpers for common pages. */
export async function getPrivacyDocument(): Promise<CmsDocument> {
  return getPublishedSetting(CMS_KEYS.privacyPolicy) as Promise<CmsDocument>;
}

export async function getTermsDocument(): Promise<CmsDocument> {
  return getPublishedSetting(CMS_KEYS.termsOfService) as Promise<CmsDocument>;
}

export async function getDisclaimerDocument(): Promise<CmsDocument> {
  return getPublishedSetting(CMS_KEYS.disclaimer) as Promise<CmsDocument>;
}

/** @deprecated Use getDisclaimerDocument — disclaimer is now a structured document. */
export async function getDisclaimerText(): Promise<CmsText> {
  const doc = await getDisclaimerDocument();
  return { text: doc.intro };
}

export async function getMaintenanceMode(): Promise<CmsMaintenance> {
  return getPublishedSetting(CMS_KEYS.maintenanceMode) as Promise<CmsMaintenance>;
}

export async function getPaymentInfo(): Promise<CmsPaymentInfo> {
  return getPublishedSetting(CMS_KEYS.paymentInfo) as Promise<CmsPaymentInfo>;
}

export async function getContactInfo(): Promise<CmsContact> {
  return getPublishedSetting(CMS_KEYS.contact) as Promise<CmsContact>;
}

export async function getConsentTexts() {
  return getCachedConsentTexts();
}

const getCachedConsentTexts = unstable_cache(
  async () => {
    const [register, birthPrivacy, birthEditLimit] = await Promise.all([
      getPublishedSetting(CMS_KEYS.consentRegister) as Promise<CmsText>,
      getPublishedSetting(CMS_KEYS.consentBirthPrivacy) as Promise<CmsText>,
      getPublishedSetting(CMS_KEYS.consentBirthEditLimit) as Promise<CmsText>,
    ]);
    return { register, birthPrivacy, birthEditLimit };
  },
  ["cms-consent-texts"],
  { revalidate: 60 },
);

export async function getActiveAnnouncements(now = new Date()) {
  const rows = await prisma.siteAnnouncement.findMany({
    where: { enabled: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
  return rows.filter((row) => {
    if (row.startsAt && row.startsAt > now) return false;
    if (row.endsAt && row.endsAt < now) return false;
    return true;
  });
}

export async function getPublishedFaqItems() {
  return prisma.faqItem.findMany({
    where: { enabled: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, question: true, answer: true, category: true },
  });
}
