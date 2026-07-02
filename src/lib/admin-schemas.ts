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
  promptTemplateId: z.string().optional(),
  aiConfigId: z.string().optional(),
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
});

export const packageUpdateSchema = packageCreateSchema.partial();
