import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import { env } from "@/config/env";
import { sendEmail } from "@/server/email/mailer";
import { normalizeEmail } from "@/server/auth/account-lookup";

/** Reset links are valid for 30 minutes. */
export const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;

/** Generate a URL-safe random reset token (the raw value emailed to the user). */
export function generateResetToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Hash a reset token for storage. We store only the hash so a DB leak cannot be
 * used to reset accounts; the raw token lives only in the emailed link.
 */
export function hashResetToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/** Pure helper: has this token expired / been used relative to `now`? */
export function isResetTokenUsable(
  token: { expiresAt: Date; usedAt: Date | null },
  now: Date = new Date(),
): boolean {
  if (token.usedAt) return false;
  return token.expiresAt.getTime() > now.getTime();
}

function buildBaseUrl(): string {
  return env.APP_BASE_URL || env.AUTH_URL || "http://localhost:3000";
}

/**
 * Start the forgot-password flow for an email. Always resolves successfully so
 * the caller can return a generic response (never reveal whether the email
 * exists). Only sends a link when the account exists AND has a password
 * (Google-only accounts have no password to reset).
 */
export async function requestPasswordReset(rawEmail: string): Promise<void> {
  const email = normalizeEmail(rawEmail);
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.passwordHash || user.status === "DISABLED") {
    return; // silently no-op — do not leak account state
  }

  // Invalidate any outstanding tokens for this user before issuing a new one.
  await prisma.passwordResetToken.deleteMany({
    where: { userId: user.id, usedAt: null },
  });

  const rawToken = generateResetToken();
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashResetToken(rawToken),
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
    },
  });

  const link = `${buildBaseUrl()}/reset-password?token=${rawToken}`;
  await sendEmail({
    to: email,
    subject: "รีเซ็ตรหัสผ่าน HoraSard",
    text: [
      "คุณ (หรือใครบางคน) ขอรีเซ็ตรหัสผ่านสำหรับบัญชี HoraSard นี้",
      "",
      "คลิกลิงก์ด้านล่างเพื่อตั้งรหัสผ่านใหม่ (ลิงก์หมดอายุใน 30 นาที):",
      link,
      "",
      "หากคุณไม่ได้เป็นผู้ขอ สามารถเพิกเฉยอีเมลนี้ได้",
    ].join("\n"),
  });
}

/**
 * Complete the reset: validate the raw token, set a new password, and mark the
 * token used. Throws AppError on invalid/expired token.
 */
export async function resetPassword(rawToken: string, newPassword: string): Promise<void> {
  const tokenHash = hashResetToken(rawToken);
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!record || !isResetTokenUsable(record)) {
    throw new AppError("VALIDATION", "ลิงก์รีเซ็ตไม่ถูกต้องหรือหมดอายุแล้ว");
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);
}
