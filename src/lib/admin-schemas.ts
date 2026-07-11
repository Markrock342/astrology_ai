import { z } from "zod";

/**
 * Zod schemas for Admin CMS endpoints. Kept separate from the user-facing
 * `schemas.ts` (the FE contract) — these are admin-only inputs.
 */

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
});

export const userListQuerySchema = listQuerySchema.extend({
  status: z.enum(["ACTIVE", "DISABLED"]).optional(),
  role: z.enum(["USER", "ADMIN", "SUPER_ADMIN"]).optional(),
});

export const userStatusSchema = z.object({
  status: z.enum(["ACTIVE", "DISABLED"]),
});

export const userCreditSchema = z.object({
  amount: z.number().int().positive(),
  type: z.enum(["ADMIN_ADD", "ADMIN_DEDUCT", "PROMOTION", "REFUND"]),
  note: z.string().max(300).optional(),
});

export const userSubscriptionSchema = z.object({
  packageCode: z.string().min(1),
  // ISO date string; null / omitted = indefinite (manual Pro without expiry).
  expiresAt: z.coerce.date().nullish(),
  // Grant the package's creditQuota to the wallet on activation.
  grantCredits: z.boolean().default(false),
});

export const userRoleSchema = z.object({
  role: z.enum(["USER", "ADMIN", "SUPER_ADMIN"]),
});

export const auditLogQuerySchema = listQuerySchema.extend({
  entityType: z.string().trim().max(60).optional(),
});

export const aiUsageQuerySchema = listQuerySchema.extend({
  status: z.enum(["SUCCESS", "FAILED", "TIMEOUT"]).optional(),
});

/** CMS document page (privacy, terms). */
export const cmsDocumentSchema = z.object({
  title: z.string().min(1).max(200),
  lastUpdated: z.string().max(80),
  intro: z.string().max(2000),
  sections: z
    .array(
      z.object({
        heading: z.string().min(1).max(200),
        body: z.array(z.string().min(1).max(1000)).min(1),
      }),
    )
    .min(1),
  footer: z.string().max(1000).optional(),
});

export const cmsTextSchema = z.object({
  text: z.string().min(1).max(500),
});

export const cmsContactSchema = z.object({
  email: z.string().email().max(120),
  label: z.string().max(120).optional(),
});

export const cmsMaintenanceSchema = z.object({
  enabled: z.boolean(),
  message: z.string().max(500),
});

export const cmsPaymentInfoSchema = z.object({
  title: z.string().min(1).max(200),
  bankName: z.string().min(1).max(120),
  accountName: z.string().min(1).max(120),
  accountNumber: z.string().min(1).max(60),
  amountNote: z.string().max(300),
  steps: z.array(z.string().min(1).max(300)).min(1),
  footer: z.string().max(500).optional(),
});

export const cmsSeoSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(300),
  ogTitle: z.string().max(120).optional(),
  ogDescription: z.string().max(300).optional(),
  ogImageUrl: z.string().url().max(2000).optional().or(z.literal("")),
});

export const settingUpdateSchema = z.object({
  value: z.unknown(),
});

export const contentDraftSchema = z.object({
  value: z.unknown(),
});

export const revisionRestoreSchema = z.object({
  mode: z.enum(["draft", "publish"]).default("draft"),
});

export const announcementSchema = z.object({
  title: z.string().min(1).max(120),
  message: z.string().min(1).max(500),
  tone: z.enum(["INFO", "WARNING", "PROMO", "DANGER"]).default("INFO"),
  enabled: z.boolean().default(false),
  linkUrl: z.string().url().max(2000).optional().or(z.literal("")).nullable(),
  linkLabel: z.string().max(80).optional().nullable(),
  startsAt: z.coerce.date().nullish(),
  endsAt: z.coerce.date().nullish(),
  sortOrder: z.number().int().default(0),
});

export const faqItemSchema = z.object({
  question: z.string().min(1).max(300),
  answer: z.string().min(1).max(5000),
  category: z.string().max(40).default("general"),
  enabled: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const submitPaymentSchema = z.object({
  amount: z.number().int().positive(),
  reference: z.string().max(120).optional(),
  note: z.string().max(300).optional(),
  proofUrl: z.string().url().max(2000),
});

export const paymentListQuerySchema = listQuerySchema.extend({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
});

export const paymentReviewSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().max(300).optional(),
  packageCode: z.string().min(1).optional(),
});

export const categoryCreateSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "slug ต้องเป็นตัวพิมพ์เล็ก ตัวเลข หรือขีดกลางเท่านั้น"),
  nameTh: z.string().min(1).max(120),
  nameEn: z.string().max(120).optional(),
  description: z.string().max(500).optional(),
  icon: z.string().max(60).optional(),
  accessLevel: z.enum(["FREE", "PRO"]).default("FREE"),
  creditCost: z.number().int().min(0).default(1),
  enabled: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  suggestedQuestions: z.array(z.string().min(1).max(200)).max(10).optional(),
  promptTemplateId: z.string().nullish(),
  aiConfigId: z.string().nullish(),
});

export const categoryUpdateSchema = categoryCreateSchema.partial();

export const packageCreateSchema = z.object({
  code: z.string().min(1).max(40),
  name: z.string().min(1).max(80),
  type: z.enum(["FREE", "PRO"]).default("FREE"),
  price: z.number().int().min(0).default(0),
  billingLabel: z.string().max(60).optional(),
  creditQuota: z.number().int().min(0).default(0),
  dailyLimit: z.number().int().min(0).nullish(),
  monthlyLimit: z.number().int().min(0).nullish(),
  enabled: z.boolean().default(true),
  description: z.string().max(500).optional(),
  features: z.array(z.string().min(1).max(200)).default([]),
  upgradeSteps: z.array(z.string().min(1).max(300)).default([]),
});

export const packageUpdateSchema = packageCreateSchema.partial();

export const promptCreateSchema = z.object({
  code: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9_-]+$/, "code ต้องเป็นตัวพิมพ์เล็ก ตัวเลข _ หรือ - เท่านั้น"),
  name: z.string().min(1).max(120),
  type: z.enum(["SYSTEM", "PERSONA", "CATEGORY", "FORMAT"]),
  content: z.string().min(1).max(20_000),
  enabled: z.boolean().default(true),
});

export const promptUpdateSchema = promptCreateSchema.omit({ code: true }).partial();

export const aiConfigCreateSchema = z.object({
  provider: z.enum(["GEMINI", "OPENAI"]).default("GEMINI"),
  modelId: z.string().min(1).max(120),
  displayName: z.string().min(1).max(120),
  // Env var NAME only — the key value never touches the database.
  secretReference: z.string().min(1).max(120),
  enabled: z.boolean().default(true),
  temperature: z.number().min(0).max(2).default(0.7),
  maxOutputTokens: z.number().int().min(64).max(32_768).default(2048),
  timeoutMs: z.number().int().min(1000).max(120_000).default(30_000),
  fallbackConfigId: z.string().nullish(),
  planScope: z.enum(["FREE", "PRO", "ALL"]).default("ALL"),
  categoryId: z.string().nullish(),
  promptTemplateId: z.string().nullish(),
  versionLabel: z.string().max(60).optional(),
  notes: z.string().max(500).optional(),
});

export const aiConfigUpdateSchema = aiConfigCreateSchema.partial();

export const knowledgeCreateSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(50_000),
  categoryId: z.string().nullish(),
  enabled: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const knowledgeUpdateSchema = knowledgeCreateSchema.partial();
