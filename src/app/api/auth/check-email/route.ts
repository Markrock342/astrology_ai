import { handle, ok } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { checkEmailSchema } from "@/lib/schemas";
import { getEmailAuthStatus } from "@/server/auth/account-lookup";

/**
 * POST /api/auth/check-email — lets the single sign-in surface decide whether to
 * show the login step or the registration step. Returns { exists, hasPassword }.
 */
export async function POST(req: Request) {
  return handle(async () => {
    await rateLimit(`check-email:${req.headers.get("x-forwarded-for") ?? "local"}`, 20, 60_000);
    const { email } = checkEmailSchema.parse(await req.json());
    return ok(await getEmailAuthStatus(email));
  });
}
