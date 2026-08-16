import { handle, ok, fail } from "@/lib/http";
import { env } from "@/config/env";
import {
  forwardInboundSupport,
  verifyResendWebhook,
} from "@/server/email/inbound";

/**
 * POST /api/webhooks/resend — Resend inbound / webhook receiver.
 * Forwards mail addressed to support@horasard.com to ADMIN_ALERT_EMAIL.
 */
export async function POST(req: Request) {
  return handle(async () => {
    const secret = env.RESEND_WEBHOOK_SECRET?.trim();
    const raw = await req.text();
    if (!secret) {
      return fail("FEATURE_DISABLED", "Inbound email is not configured", 503);
    }
    if (!verifyResendWebhook(raw, req.headers, secret)) {
      return fail("UNAUTHENTICATED", "Invalid webhook signature", 401);
    }

    let payload: unknown = {};
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      return fail("VALIDATION", "Invalid JSON", 422);
    }

    const result = await forwardInboundSupport(
      payload as Parameters<typeof forwardInboundSupport>[0],
    );
    return ok(result);
  });
}
