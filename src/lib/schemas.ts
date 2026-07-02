import { z } from "zod";

/**
 * Shared Zod schemas used by API route handlers and services. Every request is
 * validated (spec 11). Extend these as endpoints are implemented.
 */

export const registerSchema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  acceptTerms: z.literal(true),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const birthProfileSchema = z.object({
  nickname: z.string().max(60).optional(),
  birthDate: z.coerce.date(),
  birthTime: z.string().optional(),
  birthTimeKnown: z.boolean().default(true),
  gender: z.string().max(40).optional(),
  birthLocation: z.string().max(120).optional(),
  additionalInfo: z.string().max(500).optional(),
});

export const createReadingSchema = z.object({
  categorySlug: z.string().min(1),
  question: z.string().min(1).max(1000),
});

export const adminCreditSchema = z.object({
  amount: z.number().int(),
  type: z.enum(["ADMIN_ADD", "ADMIN_DEDUCT", "PROMOTION", "REFUND"]),
  note: z.string().max(300).optional(),
});

export const manualPaymentSchema = z.object({
  userId: z.string().min(1),
  amount: z.number().int().positive(),
  reference: z.string().max(120).optional(),
  note: z.string().max(300).optional(),
});
