import { Prisma } from "@prisma/client";
import {
  createHmac,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import { ADMIN_2FA_TTL_MS, APP_NAME } from "@/config/constants";
import {
  encryptSecret,
  decryptSecret,
  isEncryptionConfigured,
} from "@/lib/crypto/secret-box";
import { writeAudit } from "@/server/audit/audit-service";

const COOKIE_NAME = "horasard_admin_2fa";
const PENDING_COOKIE = "horasard_admin_2fa_pending";

function authDerivedKeyB64(): string {
  const raw = process.env.AUTH_SECRET?.trim();
  if (!raw) {
    throw new AppError(
      "INTERNAL",
      "ต้องตั้ง AI_SECRET_ENC_KEY หรือ AUTH_SECRET สำหรับ 2FA",
    );
  }
  return createHash("sha256").update(`totp:${raw}`).digest("base64");
}

function encryptTotpSecret(plain: string): string {
  if (isEncryptionConfigured()) return encryptSecret(plain);
  return encryptSecret(plain, authDerivedKeyB64());
}

function decryptTotpSecret(enc: string): string {
  if (isEncryptionConfigured()) return decryptSecret(enc);
  return decryptSecret(enc, authDerivedKeyB64());
}

/** Current TOTP time-step (30s period). Combined with validate()'s delta this
 *  gives the absolute step a code belongs to, for replay tracking. */
function currentTotpStep(): number {
  return Math.floor(Date.now() / 30_000);
}

function signPayload(payload: string): string {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) throw new AppError("INTERNAL", "AUTH_SECRET missing");
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function buildCookieValue(userId: string, exp: number): string {
  const payload = `${userId}.${exp}`;
  return `${payload}.${signPayload(payload)}`;
}

function parseCookieValue(
  value: string | undefined,
): { userId: string; exp: number } | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [userId, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!userId || !Number.isFinite(exp) || exp < Date.now()) return null;
  const payload = `${userId}.${exp}`;
  const expected = signPayload(payload);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return { userId, exp };
}

function buildPendingValue(
  userId: string,
  secretBase32: string,
  exp: number,
): string {
  const payload = `${userId}|${secretBase32}|${exp}`;
  const body = Buffer.from(payload, "utf8").toString("base64url");
  return `${body}.${signPayload(payload)}`;
}

function parsePendingValue(
  value: string | undefined,
  expectedUserId: string,
): string {
  if (!value) {
    throw new AppError("VALIDATION", "เซสชันตั้งค่า 2FA หมดอายุ — เริ่มใหม่");
  }
  const [body, sig] = value.split(".");
  if (!body || !sig) {
    throw new AppError("VALIDATION", "เซสชันตั้งค่า 2FA ไม่ถูกต้อง");
  }
  const payload = Buffer.from(body, "base64url").toString("utf8");
  const expected = signPayload(payload);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new AppError("VALIDATION", "เซสชันตั้งค่า 2FA ไม่ถูกต้อง");
    }
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError("VALIDATION", "เซสชันตั้งค่า 2FA ไม่ถูกต้อง");
  }
  const [userId, secretBase32, expStr] = payload.split("|");
  const exp = Number(expStr);
  if (
    userId !== expectedUserId ||
    !secretBase32 ||
    !Number.isFinite(exp) ||
    exp < Date.now()
  ) {
    throw new AppError("VALIDATION", "เซสชันตั้งค่า 2FA หมดอายุ — เริ่มใหม่");
  }
  return secretBase32;
}

export async function getAdmin2faStatus(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpEnabledAt: true, role: true },
  });
  if (!user) throw new AppError("NOT_FOUND", "User not found");
  const jar = await cookies();
  const verified = parseCookieValue(jar.get(COOKIE_NAME)?.value);
  return {
    enrolled: Boolean(user.totpEnabledAt),
    verified:
      Boolean(verified) &&
      verified!.userId === userId &&
      verified!.exp > Date.now(),
  };
}

export async function assertAdmin2faVerified(userId: string): Promise<void> {
  const status = await getAdmin2faStatus(userId);
  if (!status.enrolled) {
    throw new AppError("FORBIDDEN", "ต้องตั้งค่า 2FA ก่อนเข้าแอดมิน");
  }
  if (!status.verified) {
    throw new AppError("FORBIDDEN", "ต้องยืนยัน 2FA ก่อน");
  }
}

export async function beginTotpEnrollment(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, totpEnabledAt: true },
  });
  if (!user) throw new AppError("NOT_FOUND", "User not found");
  if (user.totpEnabledAt) {
    throw new AppError("VALIDATION", "ตั้งค่า 2FA แล้ว");
  }

  const secret = new OTPAuth.Secret({ size: 20 });
  const totp = new OTPAuth.TOTP({
    issuer: APP_NAME,
    label: user.email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret,
  });
  const uri = totp.toString();
  const qrDataUrl = await QRCode.toDataURL(uri, { margin: 1, width: 220 });

  const jar = await cookies();
  const exp = Date.now() + 15 * 60 * 1000;
  jar.set(PENDING_COOKIE, buildPendingValue(userId, secret.base32, exp), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 15 * 60,
  });

  return { qrDataUrl, otpauthUrl: uri, secretBase32: secret.base32 };
}

export async function confirmTotpEnrollment(
  userId: string,
  code: string,
  actorIp?: string,
) {
  const jar = await cookies();
  const secretBase32 = parsePendingValue(
    jar.get(PENDING_COOKIE)?.value,
    userId,
  );

  const totp = new OTPAuth.TOTP({
    issuer: APP_NAME,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
  const delta = totp.validate({ token: code.replace(/\s/g, ""), window: 1 });
  if (delta === null) {
    throw new AppError("VALIDATION", "รหัส 2FA ไม่ถูกต้อง");
  }

  const backupPlain = Array.from({ length: 8 }, () =>
    randomBytes(4).toString("hex"),
  );
  const backupHashes = await Promise.all(
    backupPlain.map((c) => bcrypt.hash(c, 10)),
  );

  await prisma.user.update({
    where: { id: userId },
    data: {
      totpSecretEnc: encryptTotpSecret(secretBase32),
      totpEnabledAt: new Date(),
      totpBackupCodesJson: backupHashes,
      // Burn the enrollment code's step so it can't immediately be replayed to
      // pass a login verification.
      totpLastStep: currentTotpStep() + delta,
    },
  });

  jar.delete(PENDING_COOKIE);
  await setAdmin2faCookie(userId);
  await writeAudit({
    adminUserId: userId,
    action: "admin.2fa.enroll",
    entityType: "user",
    entityId: userId,
    before: null,
    after: { enrolled: true },
    ipAddress: actorIp,
  });

  return { backupCodes: backupPlain };
}

export async function verifyTotpLogin(
  userId: string,
  code: string,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      totpSecretEnc: true,
      totpBackupCodesJson: true,
      totpLastStep: true,
    },
  });
  if (!user?.totpSecretEnc) {
    throw new AppError("VALIDATION", "ยังไม่ได้ตั้งค่า 2FA");
  }

  const token = code.replace(/\s/g, "");
  const secretBase32 = decryptTotpSecret(user.totpSecretEnc);
  const totp = new OTPAuth.TOTP({
    issuer: APP_NAME,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
  const delta = totp.validate({ token, window: 1 });
  if (delta !== null) {
    // Replay guard: reject a code whose time-step was already accepted, so a
    // captured code can't be reused within its ~90s validity window.
    const step = currentTotpStep() + delta;
    if (user.totpLastStep != null && step <= user.totpLastStep) {
      throw new AppError("VALIDATION", "รหัส 2FA นี้ถูกใช้ไปแล้ว กรุณารอรหัสถัดไป");
    }
    await prisma.user.update({
      where: { id: userId },
      data: { totpLastStep: step },
    });
    await setAdmin2faCookie(userId);
    return;
  }

  const hashes = Array.isArray(user.totpBackupCodesJson)
    ? (user.totpBackupCodesJson as string[])
    : [];
  for (let i = 0; i < hashes.length; i++) {
    if (await bcrypt.compare(token, hashes[i]!)) {
      const next = [...hashes];
      next.splice(i, 1);
      await prisma.user.update({
        where: { id: userId },
        data: { totpBackupCodesJson: next },
      });
      await setAdmin2faCookie(userId);
      return;
    }
  }

  throw new AppError("VALIDATION", "รหัส 2FA ไม่ถูกต้อง");
}

async function setAdmin2faCookie(userId: string): Promise<void> {
  const jar = await cookies();
  const exp = Date.now() + ADMIN_2FA_TTL_MS;
  jar.set(COOKIE_NAME, buildCookieValue(userId, exp), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(ADMIN_2FA_TTL_MS / 1000),
  });
}

/** Super Admin resets another admin's 2FA (forces re-enroll). */
export async function resetAdminTotp(
  targetUserId: string,
  actor: { id: string; ip?: string },
): Promise<void> {
  if (targetUserId === actor.id) {
    throw new AppError(
      "VALIDATION",
      "รีเซ็ต 2FA ของตัวเองไม่ได้ — ใช้รหัสสำรอง",
    );
  }
  const before = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, totpEnabledAt: true, role: true },
  });
  if (!before) throw new AppError("NOT_FOUND", "User not found");

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: targetUserId },
      data: {
        totpSecretEnc: null,
        totpEnabledAt: null,
        totpBackupCodesJson: Prisma.DbNull,
      },
    });
    await writeAudit(
      {
        adminUserId: actor.id,
        action: "admin.2fa.reset",
        entityType: "user",
        entityId: targetUserId,
        before: { totpEnabledAt: before.totpEnabledAt },
        after: { totpEnabledAt: null },
        ipAddress: actor.ip,
      },
      tx,
    );
  });
}
