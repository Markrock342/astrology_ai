import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import { env } from "@/config/env";
import { sendEmail } from "@/server/email/mailer";
import {
  generateResetToken,
  hashResetToken,
} from "@/server/auth/password-reset-service";

/** Verification links are valid for 24 hours. */
export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

function buildBaseUrl(): string {
  return env.APP_BASE_URL || env.AUTH_URL || "http://localhost:3000";
}

/**
 * Issue a fresh verification email for an email/password account.
 * No-op when already verified or account is Google-only (no password).
 */
export async function sendVerificationEmail(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, emailVerifiedAt: true, passwordHash: true, status: true },
  });
  if (!user || user.status === "DISABLED") return false;
  if (!user.passwordHash || user.emailVerifiedAt) return false;

  await prisma.emailVerificationToken.deleteMany({
    where: { userId: user.id, usedAt: null },
  });

  const rawToken = generateResetToken();
  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash: hashResetToken(rawToken),
      expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
    },
  });

  const link = `${buildBaseUrl()}/verify-email?token=${rawToken}`;
  await sendEmail({
    to: user.email,
    subject: "ยืนยันอีเมล HoraSard",
    text: [
      "ขอบคุณที่สมัครใช้งาน HoraSard (โหราศาสตร์)",
      "",
      "กรุณาคลิกลิงก์ด้านล่างเพื่อยืนยันอีเมลของคุณ (ลิงก์หมดอายุใน 24 ชั่วโมง):",
      link,
      "",
      "หากคุณไม่ได้สมัครบัญชีนี้ สามารถเพิกเฉยอีเมลนี้ได้",
    ].join("\n"),
  });
  return true;
}

/** Consume a verification token and mark the user's email as verified. */
export async function verifyEmailToken(rawToken: string): Promise<void> {
  const tokenHash = hashResetToken(rawToken);
  const row = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, status: true } } },
  });

  if (!row || row.usedAt || row.expiresAt.getTime() <= Date.now()) {
    throw new AppError("VALIDATION", "ลิงก์ยืนยันไม่ถูกต้องหรือหมดอายุแล้ว");
  }
  if (row.user.status === "DISABLED") {
    throw new AppError("USER_DISABLED", "บัญชีนี้ถูกระงับ");
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: { emailVerifiedAt: new Date() },
    }),
    prisma.emailVerificationToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    }),
    prisma.emailVerificationToken.deleteMany({
      where: { userId: row.userId, usedAt: null, id: { not: row.id } },
    }),
  ]);
}

/** Whether the user should see the soft verification banner. */
export function needsEmailVerification(user: {
  emailVerifiedAt: Date | null;
  passwordHash: string | null;
}): boolean {
  return Boolean(user.passwordHash && !user.emailVerifiedAt);
}
