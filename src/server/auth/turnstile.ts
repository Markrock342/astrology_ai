import { env } from "@/config/env";
import { AppError } from "@/lib/errors";

type SiteVerifyResponse = {
  success: boolean;
  "error-codes"?: string[];
};

/**
 * Verify a Cloudflare Turnstile token server-side.
 * When TURNSTILE_SECRET_KEY is unset (local dev), verification is skipped.
 */
export async function verifyTurnstile(
  token: string | undefined,
  remoteIp?: string | null,
): Promise<void> {
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) return;

  if (!token?.trim()) {
    throw new AppError("FORBIDDEN", "กรุณายืนยันว่าไม่ใช่บอท");
  }

  const body = new URLSearchParams({
    secret,
    response: token,
  });
  if (remoteIp) body.set("remoteip", remoteIp);

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    throw new AppError("INTERNAL", "ไม่สามารถตรวจสอบ Turnstile ได้");
  }

  const data = (await res.json()) as SiteVerifyResponse;
  if (!data.success) {
    throw new AppError("FORBIDDEN", "การตรวจสอบบอทไม่ผ่าน กรุณาลองใหม่");
  }
}

export function clientIp(req: Request): string | undefined {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;
}
