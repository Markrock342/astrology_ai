import { put } from "@vercel/blob";
import { handle, ok } from "@/lib/http";
import { AppError } from "@/lib/errors";
import { requireAdmin } from "@/server/auth/rbac";

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * POST /api/admin/upload — admin image upload to Vercel Blob.
 * Used for OG images, landing hero/features, announcement images.
 */
export async function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      throw new AppError(
        "INTERNAL",
        "ระบบอัปโหลดยังไม่ได้ตั้งค่า (BLOB_READ_WRITE_TOKEN)",
      );
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new AppError("VALIDATION", "กรุณาแนบไฟล์รูป");
    }
    if (!ALLOWED.has(file.type)) {
      throw new AppError("VALIDATION", "รองรับเฉพาะ JPG, PNG หรือ WebP");
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
      throw new AppError("VALIDATION", "ขนาดไฟล์ต้องไม่เกิน 4 MB");
    }

    const ext =
      file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const pathname = `cms/${admin.id}/${Date.now()}.${ext}`;
    const blob = await put(pathname, file, {
      access: "public",
      token,
      contentType: file.type,
    });

    return ok({ url: blob.url }, { status: 201 });
  });
}
