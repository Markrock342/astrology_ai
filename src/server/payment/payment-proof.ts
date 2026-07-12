import { del, get, put } from "@vercel/blob";
import { AppError } from "@/lib/errors";

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
): Promise<{ pathname: string }> {
  const ext =
    file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const pathname = `payment-slips/${userId}/${Date.now()}.${ext}`;
  await put(pathname, file, {
    access: "private",
    token,
    contentType: file.type,
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
  const contentType =
    result.blob.contentType || result.headers.get("content-type") || "image/jpeg";
  headers.set("Content-Type", contentType);
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
