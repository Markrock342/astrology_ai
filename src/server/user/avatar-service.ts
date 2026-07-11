import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";

const MAX_BYTES = 512 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Save a profile photo for email/password users (stored as data URL). */
export async function updateUserAvatar(userId: string, file: File): Promise<{ image: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!user) throw new AppError("NOT_FOUND", "User not found");

  if (!user.passwordHash) {
    throw new AppError(
      "VALIDATION",
      "บัญชี Google ใช้รูปจาก Google โดยอัตโนมัติ — ไม่ต้องอัปโหลด",
    );
  }

  if (!ALLOWED.has(file.type)) {
    throw new AppError("VALIDATION", "รองรับเฉพาะ JPG, PNG หรือ WebP");
  }
  if (file.size > MAX_BYTES) {
    throw new AppError("VALIDATION", "ไฟล์ใหญ่เกินไป (สูงสุด 512 KB)");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const image = `data:${file.type};base64,${buffer.toString("base64")}`;

  await prisma.user.update({
    where: { id: userId },
    data: { image },
  });

  return { image };
}

/** Sync Google profile photo on OAuth sign-in. */
export async function syncGoogleProfile(input: {
  email: string;
  name?: string | null;
  image?: string | null;
}): Promise<void> {
  if (!input.image) return;
  await prisma.user.update({
    where: { email: input.email },
    data: {
      image: input.image,
      ...(input.name ? { name: input.name } : {}),
    },
  });
}
