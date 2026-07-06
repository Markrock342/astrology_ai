import bcrypt from "bcryptjs";
import { prisma } from "@/server/db";
import { signIn } from "@/auth";
import { loginSchema } from "@/lib/schemas";
import { handle, ok, fail } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { normalizeEmail } from "@/server/auth/account-lookup";
import { verifyTurnstile, clientIp } from "@/server/auth/turnstile";

/**
 * Credentials login with Turnstile verification. Signs the user in on the
 * server in one request (same pattern as register).
 */
export async function POST(req: Request) {
  return handle(async () => {
    rateLimit(`login:${req.headers.get("x-forwarded-for") ?? "local"}`, 20, 60_000);

    const body = await req.json();
    const data = loginSchema.parse(body);
    await verifyTurnstile(data.turnstileToken, clientIp(req));

    const email = normalizeEmail(data.email);
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) return fail("VALIDATION", "อีเมลหรือรหัสผ่านไม่ถูกต้อง", 422);
    if (!user.passwordHash) {
      return fail(
        "VALIDATION",
        "บัญชีนี้สมัครด้วย Google — กรุณาใช้ปุ่ม Continue with Google",
        422,
      );
    }
    if (user.status === "DISABLED") {
      return fail("VALIDATION", "อีเมลหรือรหัสผ่านไม่ถูกต้อง", 422);
    }

    const valid = await bcrypt.compare(data.password, user.passwordHash);
    if (!valid) return fail("VALIDATION", "อีเมลหรือรหัสผ่านไม่ถูกต้อง", 422);

    const authResult = await signIn("credentials", {
      email,
      password: data.password,
      redirect: false,
    });

    if (authResult && "error" in authResult && authResult.error) {
      return fail("VALIDATION", "อีเมลหรือรหัสผ่านไม่ถูกต้อง", 422);
    }

    return ok({ signedIn: true });
  });
}
