import { z } from "zod";

/**
 * Shared Zod schemas used by API route handlers and services. Every request is
 * validated (spec 11). Extend these as endpoints are implemented.
 */

export const registerSchema = z.object({
  // The unified sign-in surface only collects email + password; name is optional
  // and can be filled in later from account settings.
  name: z.string().min(1).max(80).optional(),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  acceptTerms: z.literal(true),
  turnstileToken: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  turnstileToken: z.string().optional(),
});

export const checkEmailSchema = z.object({
  email: z.string().email(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
  turnstileToken: z.string().optional(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(16),
  password: z.string().min(8).max(128),
});

/**
 * Birth profile input (central FE/BE contract — coordinate before changing).
 * Year may be Buddhist (พ.ศ.) or Gregorian (ค.ศ.); the service normalizes it to
 * Gregorian and stores the instant in UTC. Province/district are required
 * (structured Thai location); country defaults to ไทย.
 */
export const birthProfileSchema = z
  .object({
    nickname: z.string().max(60).optional(),
    year: z.number().int().min(1900).max(2600),
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31),
    yearEra: z.enum(["BE", "CE"]).optional(),
    birthTimeKnown: z.boolean().default(true),
    hour: z.number().int().min(0).max(23).optional(),
    minute: z.number().int().min(0).max(59).optional(),
    gender: z.string().max(40).optional(),
    birthCountry: z.string().max(60).default("ไทย"),
    birthProvince: z.string().min(1).max(80),
    birthDistrict: z.string().min(1).max(80),
    additionalInfo: z.string().max(500).optional(),
  })
  .refine((v) => !v.birthTimeKnown || (v.hour !== undefined && v.minute !== undefined), {
    message: "ต้องระบุเวลาเกิด (ชั่วโมงและนาที) เมื่อทราบเวลาเกิด",
    path: ["hour"],
  });

export const createReadingSchema = z.object({
  categorySlug: z.string().min(1),
  question: z.string().min(1).max(1000),
});

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(80),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8).max(128),
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

export const resendVerificationSchema = z.object({
  turnstileToken: z.string().optional(),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(16),
});
