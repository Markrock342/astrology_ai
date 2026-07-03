import { handle, ok } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { forgotPasswordSchema } from "@/lib/schemas";
import { requestPasswordReset } from "@/server/auth/password-reset-service";

/**
 * POST /api/auth/forgot-password — send a reset link if the account exists.
 * Always returns a generic success so the endpoint never reveals whether an
 * email is registered.
 */
export async function POST(req: Request) {
  return handle(async () => {
    rateLimit(`forgot-password:${req.headers.get("x-forwarded-for") ?? "local"}`, 5, 60_000);
    const { email } = forgotPasswordSchema.parse(await req.json());
    await requestPasswordReset(email);
    return ok({ sent: true });
  });
}
