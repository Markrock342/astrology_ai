import { del, get, put, list } from "@vercel/blob";
import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";

export const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

/**
 * Verify the file's REAL type from its magic bytes — the client-declared
 * `file.type` is trivially spoofable, so an attacker could store arbitrary
 * bytes under an `image/png` label. Returns the detected MIME or null.
 */
export function sniffImageType(head: Uint8Array): string | null {
  // JPEG: FF D8 FF
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return "image/jpeg";
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    head[0] === 0x89 &&
    head[1] === 0x50 &&
    head[2] === 0x4e &&
    head[3] === 0x47 &&
    head[4] === 0x0d &&
    head[5] === 0x0a &&
    head[6] === 0x1a &&
    head[7] === 0x0a
  ) {
    return "image/png";
  }
  // WebP: "RIFF" .... "WEBP"
  if (
    head[0] === 0x52 &&
    head[1] === 0x49 &&
    head[2] === 0x46 &&
    head[3] === 0x46 &&
    head[8] === 0x57 &&
    head[9] === 0x45 &&
    head[10] === 0x42 &&
    head[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

/** Stored in Payment.proofUrl — either a legacy public https URL or a private pathname. */
export function isLegacyPublicProofUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

/** Browser-facing URL for slip images (authenticated proxy for private pathnames). */
export function proofImageSrc(
  paymentId: string,
  proofUrl: string | null | undefined,
): string | null {
  if (!proofUrl) return null;
  if (isLegacyPublicProofUrl(proofUrl)) return proofUrl;
  return `/api/payments/proof/${paymentId}`;
}

export function assertOwnedProofPath(userId: string, proofPath: string): string {
  const path = proofPath.trim();
  const prefix = `payment-slips/${userId}/`;
  if (!path.startsWith(prefix) || path.includes("..") || path.includes("//")) {
    throw new AppError("VALIDATION", "พาธสลิปไม่ถูกต้อง");
  }
  if (path.length > 300) {
    throw new AppError("VALIDATION", "พาธสลิปยาวเกินไป");
  }
  return path;
}

const blobToken = () => process.env.BLOB_READ_WRITE_TOKEN?.trim() || null;

/** Where new slips go: the Blob store when the server has its token, else the database. */
export function slipStorage(): "blob" | "database" {
  return blobToken() ? "blob" : "database";
}

/**
 * Save a slip privately; returns the path Payment.proofUrl keeps. Without a
 * Blob token the upload used to fail outright ("ระบบอัปโหลดสลิปยังไม่ได้ตั้งค่า")
 * — nobody could pay after the move to Coolify. Slips are small (≤ 2 MB).
 */
export async function uploadPrivatePaymentSlip(
  userId: string,
  file: File,
  /** Server-detected MIME (from magic bytes), NOT the client-declared type. */
  detectedType: string,
): Promise<{ pathname: string }> {
  const ext =
    detectedType === "image/png"
      ? "png"
      : detectedType === "image/webp"
        ? "webp"
        : "jpg";
  // Random suffix so the key isn't guessable from userId + timestamp, and so two
  // uploads in the same millisecond can't collide/overwrite.
  const pathname = `payment-slips/${userId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}.${ext}`;
  const token = blobToken();
  if (token) {
    await put(pathname, file, {
      access: "private",
      token,
      contentType: detectedType,
      addRandomSuffix: false,
    });
  } else {
    await prisma.paymentSlip.create({
      data: { pathname, userId, contentType: detectedType, bytes: Buffer.from(await file.arrayBuffer()) },
    });
  }
  return { pathname };
}

function slipHeaders(stored: string): Headers {
  const headers = new Headers();
  // Only ever serve the slip as one of the allowed image types — never honour a
  // spoofed type that could sniff into something executable.
  headers.set("Content-Type", ALLOWED_IMAGE_TYPES.has(stored) ? stored : "image/jpeg");
  // Defense in depth: forbid MIME sniffing and force inline image rendering, so
  // a non-image byte-stream stored under an image label can't become active
  // content in the admin's browser.
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Content-Disposition", "inline");
  headers.set("Cache-Control", "private, max-age=60");
  return headers;
}

export async function streamPaymentProof(proofUrl: string): Promise<Response> {
  if (isLegacyPublicProofUrl(proofUrl)) {
    return Response.redirect(proofUrl, 302);
  }
  const row = await prisma.paymentSlip.findUnique({ where: { pathname: proofUrl } });
  if (row) {
    return new Response(new Uint8Array(row.bytes), { status: 200, headers: slipHeaders(row.contentType) });
  }
  const token = blobToken();
  if (!token) {
    // Slips from before the move to Coolify live in the Blob store.
    throw new AppError("NOT_FOUND", "สลิปนี้อยู่ในที่เก็บไฟล์เดิม — เปิดดูได้เมื่อตั้ง BLOB_READ_WRITE_TOKEN");
  }
  const result = await get(proofUrl, { access: "private", token });
  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new AppError("NOT_FOUND", "ไม่พบไฟล์สลิป");
  }
  const stored = result.blob.contentType || result.headers.get("content-type") || "image/jpeg";
  return new Response(result.stream, { status: 200, headers: slipHeaders(stored) });
}

/** True once nothing is left to delete; false when the blob may still exist. */
export async function deletePaymentProofBlob(
  proofUrl: string | null | undefined,
): Promise<boolean> {
  if (!proofUrl) return true;
  const removed = await prisma.paymentSlip.deleteMany({ where: { pathname: proofUrl } });
  if (removed.count > 0) return true;
  const token = blobToken();
  if (!token) return false;
  try {
    await del(proofUrl, { token });
    return true;
  } catch (err) {
    console.error("[payment-proof] blob delete failed:", err);
    return false;
  }
}

export type StoredSlip = { url: string; pathname: string; uploadedAt: Date };

/**
 * Every slip in the store under a prefix (a user's folder, or all of them).
 * Null when there is no store to ask.
 */
export async function listStoredSlips(prefix: string, maxPages = 20): Promise<StoredSlip[] | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;
  const slips: StoredSlip[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const res = await list({ prefix, cursor, limit: 1000, token });
    for (const b of res.blobs) slips.push({ url: b.url, pathname: b.pathname, uploadedAt: new Date(b.uploadedAt) });
    if (!res.hasMore || !res.cursor) break;
    cursor = res.cursor;
  }
  return slips;
}

/** Delete these slips; true once they are gone. */
export async function deleteStoredSlips(urls: string[]): Promise<boolean> {
  if (urls.length === 0) return true;
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return false;
  try {
    for (let i = 0; i < urls.length; i += 100) await del(urls.slice(i, i + 100), { token });
    return true;
  } catch (err) {
    console.error("[payment-proof] blob delete failed:", err);
    return false;
  }
}

/**
 * A user's whole slip folder — including slips uploaded but never sent with
 * a payment, which no payment row points at (PDPA: account deletion left them).
 */
export async function deleteUserSlipFolder(userId: string): Promise<boolean> {
  await prisma.paymentSlip.deleteMany({ where: { userId } });
  if (!blobToken()) return true;
  const slips = await listStoredSlips(`payment-slips/${userId}/`).catch(() => null);
  if (!slips) return false;
  return deleteStoredSlips(slips.map((s) => s.url));
}
