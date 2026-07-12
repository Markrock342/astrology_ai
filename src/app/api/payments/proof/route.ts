import { handle, ok } from "@/lib/http";
import { AppError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { uploadPrivatePaymentSlip } from "@/server/payment/payment-proof";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * POST /api/payments/proof — upload a private payment slip to Vercel Blob.
 * Returns { pathname } (not a public URL) for Payment.proofUrl.
 */
export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    await rateLimit(`proof:${user.id}`, 5, 60_000);
    await rateLimit(`proof-day:${user.id}`, 20, 24 * 60 * 60 * 1000);

    const pending = await prisma.payment.count({
      where: { userId: user.id, status: "PENDING" },
    });
    if (pending > 0) {
      throw new AppError(
        "DUPLICATE_REQUEST",
        "มีคำขอชำระเงินรอตรวจสอบอยู่แล้ว — ไม่สามารถอัปโหลดสลิปเพิ่มได้",
      );
    }

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      throw new AppError(
        "INTERNAL",
        "ระบบอัปโหลดสลิปยังไม่ได้ตั้งค่า (BLOB_READ_WRITE_TOKEN)",
      );
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new AppError("VALIDATION", "กรุณาแนบไฟล์สลิป");
    }
    if (!ALLOWED.has(file.type)) {
      throw new AppError("VALIDATION", "รองรับเฉพาะ JPG, PNG หรือ WebP");
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
      throw new AppError("VALIDATION", "ขนาดไฟล์ต้องไม่เกิน 2 MB");
    }

    const { pathname } = await uploadPrivatePaymentSlip(user.id, file, token);
    return ok({ pathname }, { status: 201 });
  });
}
