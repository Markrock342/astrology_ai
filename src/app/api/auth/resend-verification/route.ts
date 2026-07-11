import { handle, ok } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { resendVerificationSchema } from "@/lib/schemas";
import { requireUser } from "@/server/auth/rbac";
import { sendVerificationEmail } from "@/server/auth/email-verification-service";
import { verifyTurnstile, clientIp } from "@/server/auth/turnstile";

export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    await rateLimit(`resend-verify:${user.id}`, 5, 60_000);

    const { turnstileToken } = resendVerificationSchema.parse(await req.json());
    await verifyTurnstile(turnstileToken, clientIp(req));

    const sent = await sendVerificationEmail(user.id);
    return ok({ sent });
  });
}
