import { del, get, put } from "@vercel/blob";
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

export async function uploadPrivatePaymentSlip(
  userId: string,
  file: File,
  token: string,
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
  await put(pathname, file, {
    access: "private",
    token,
    contentType: detectedType,
    addRandomSuffix: false,
  });
  return { pathname };
}

export async function streamPaymentProof(
  proofUrl: string,
  token: string,
): Promise<Response> {
  if (isLegacyPublicProofUrl(proofUrl)) {
    return Response.redirect(proofUrl, 302);
  }

  const result = await get(proofUrl, {
    access: "private",
    token,
  });
  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new AppError("NOT_FOUND", "ไม่พบไฟล์สลิป");
  }

  const headers = new Headers();
  const stored =
    result.blob.contentType || result.headers.get("content-type") || "image/jpeg";
  // Only ever serve the slip as one of the allowed image types — never honour a
  // spoofed type that could sniff into something executable.
  const contentType = ALLOWED_IMAGE_TYPES.has(stored) ? stored : "image/jpeg";
  headers.set("Content-Type", contentType);
  // Defense in depth: forbid MIME sniffing and force inline image rendering, so
  // a non-image byte-stream stored under an image label can't become active
  // content in the admin's browser.
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Content-Disposition", "inline");
  headers.set("Cache-Control", "private, max-age=60");
  return new Response(result.stream, { status: 200, headers });
}

export async function deletePaymentProofBlob(
  proofUrl: string | null | undefined,
): Promise<void> {
  if (!proofUrl) return;
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return;
  try {
    await del(proofUrl, { token });
  } catch (err) {
    console.error("[payment-proof] blob delete failed:", err);
  }
}
