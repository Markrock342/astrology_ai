import { handle, ok } from "@/lib/http";
import { rateLimit, rateLimitIp } from "@/lib/rate-limit";
import { resetPasswordSchema } from "@/lib/schemas";
import { resetPassword } from "@/server/auth/password-reset-service";

/**
 * POST /api/auth/reset-password — set a new password using a valid reset token.
 * Throws VALIDATION (422) when the token is invalid, expired, or already used.
 */
export async function POST(req: Request) {
  return handle(async () => {
    await rateLimit(`reset-password:${rateLimitIp(req)}`, 10, 60_000);
    const { token, password } = resetPasswordSchema.parse(await req.json());
    await resetPassword(token, password);
    return ok({ reset: true });
  });
}
