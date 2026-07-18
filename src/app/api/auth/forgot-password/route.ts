import { handle, ok } from "@/lib/http";
import { rateLimit, rateLimitIp } from "@/lib/rate-limit";
import { forgotPasswordSchema } from "@/lib/schemas";
import { requestPasswordReset } from "@/server/auth/password-reset-service";
import { verifyTurnstile, clientIp } from "@/server/auth/turnstile";

/**
 * POST /api/auth/forgot-password — send a reset link if the account exists.
 * Always returns a generic success so the endpoint never reveals whether an
 * email is registered.
 */
export async function POST(req: Request) {
  return handle(async () => {
    await rateLimit(`forgot-password:${rateLimitIp(req)}`, 10, 60_000);
    const body = forgotPasswordSchema.parse(await req.json());
    await verifyTurnstile(body.turnstileToken, clientIp(req));
    await requestPasswordReset(body.email);
    return ok({ sent: true });
  });
}
