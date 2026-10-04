import { handle, ok } from "@/lib/http";
import { AppError } from "@/lib/errors";
import { requireAdmin } from "@/server/auth/rbac";
import {
  CMS_ALLOWED_MIME,
  CMS_MAX_BYTES,
  uploadCmsImage,
} from "@/server/storage/cms-upload";
import { sniffImageType } from "@/server/payment/payment-proof";

/**
 * POST /api/admin/upload — admin image upload stored in Postgres (media_assets).
 * Host-agnostic: logos / OG / landing work on any host with DATABASE_URL only.
 */
export async function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new AppError("VALIDATION", "กรุณาแนบไฟล์รูป");
    }
    if (!CMS_ALLOWED_MIME.has(file.type)) {
      throw new AppError("VALIDATION", "รองรับเฉพาะ JPG, PNG หรือ WebP");
    }
    if (file.size <= 0 || file.size > CMS_MAX_BYTES) {
      throw new AppError("VALIDATION", "ขนาดไฟล์ต้องไม่เกิน 4 MB");
    }

    const bytes = await file.arrayBuffer();
    // The browser-declared type is the client's word; the bytes are the file.
    // Store what the bytes are, and refuse anything that is not an image.
    const realType = sniffImageType(new Uint8Array(bytes.slice(0, 16)));
    if (!realType || !CMS_ALLOWED_MIME.has(realType)) {
      throw new AppError("VALIDATION", "ไฟล์นี้ไม่ใช่รูป JPG, PNG หรือ WebP จริง");
    }
    const { url } = await uploadCmsImage({
      bytes,
      contentType: realType,
      uploadedById: admin.id,
    });

    return ok({ url }, { status: 201 });
  });
}
