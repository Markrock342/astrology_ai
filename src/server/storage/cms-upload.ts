import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";

export const CMS_ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const CMS_MAX_BYTES = 4 * 1024 * 1024;

/** Map MIME → file extension. Pure — unit-tested. */
export function extensionForMime(contentType: string): "jpg" | "png" | "webp" {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/jpeg") return "jpg";
  throw new AppError("VALIDATION", "รองรับเฉพาะ JPG, PNG หรือ WebP");
}

/**
 * Build a storage object path label (used for logging / audits).
 * Files themselves live in the MediaAsset table.
 */
export function buildCmsObjectPath(opts: {
  adminId: string;
  contentType: string;
  nowMs?: number;
}): string {
  if (!CMS_ALLOWED_MIME.has(opts.contentType)) {
    throw new AppError("VALIDATION", "รองรับเฉพาะ JPG, PNG หรือ WebP");
  }
  const ext = extensionForMime(opts.contentType);
  const ts = opts.nowMs ?? Date.now();
  return `cms/${opts.adminId}/${ts}.${ext}`;
}

/** Public URL path served by GET /api/media/:id — relative, works on any host. */
export function mediaPublicPath(id: string): string {
  return `/api/media/${id}`;
}

export type UploadCmsImageInput = {
  bytes: ArrayBuffer | Buffer | Uint8Array;
  contentType: string;
  uploadedById?: string;
};

/**
 * Persist a CMS image in Postgres and return a relative public URL.
 * Host-agnostic: no Vercel Blob / Supabase Storage credentials required.
 */
export async function uploadCmsImage(
  input: UploadCmsImageInput,
): Promise<{ url: string; id: string }> {
  if (!CMS_ALLOWED_MIME.has(input.contentType)) {
    throw new AppError("VALIDATION", "รองรับเฉพาะ JPG, PNG หรือ WebP");
  }

  const buf = Buffer.from(
    input.bytes instanceof ArrayBuffer
      ? new Uint8Array(input.bytes)
      : input.bytes,
  );

  if (buf.length <= 0 || buf.length > CMS_MAX_BYTES) {
    throw new AppError("VALIDATION", "ขนาดไฟล์ต้องไม่เกิน 4 MB");
  }

  const row = await prisma.mediaAsset.create({
    data: {
      contentType: input.contentType,
      bytes: buf,
      byteSize: buf.length,
      uploadedById: input.uploadedById,
    },
    select: { id: true },
  });

  return { id: row.id, url: mediaPublicPath(row.id) };
}
