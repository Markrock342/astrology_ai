import bcrypt from "bcryptjs";
import { prisma } from "@/server/db";
import { loginSchema } from "@/lib/schemas";
import { handle, ok, fail } from "@/lib/http";
import { rateLimit, rateLimitIp } from "@/lib/rate-limit";
import { normalizeEmail } from "@/server/auth/account-lookup";
import { signInCredentials } from "@/server/auth/server-sign-in";

/**
 * Credentials login — rate-limited, no Turnstile (world-class: captcha on
 * register/forgot/resend only; login protected by rate limit + bcrypt).
 */
export async function POST(req: Request) {
  return handle(async () => {
    await rateLimit(
      `login:${rateLimitIp(req)}`,
      20,
      60_000,
      { failClosed: true },
    );

    const body = await req.json();
    const data = loginSchema.parse(body);

    const email = normalizeEmail(data.email);
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) return fail("VALIDATION", "อีเมลหรือรหัสผ่านไม่ถูกต้อง", 422);
    if (!user.passwordHash) {
      return fail(
        "VALIDATION",
        "บัญชีนี้สมัครด้วย Google — กรุณาใช้ปุ่มเข้าสู่ระบบด้วย Google",
        422,
      );
    }
    if (user.status === "DISABLED") {
      return fail("VALIDATION", "อีเมลหรือรหัสผ่านไม่ถูกต้อง", 422);
    }

    const valid = await bcrypt.compare(data.password, user.passwordHash);
    if (!valid) return fail("VALIDATION", "อีเมลหรือรหัสผ่านไม่ถูกต้อง", 422);

    const signedIn = await signInCredentials(email, data.password);
    if (signedIn === "invalid") {
      return fail("VALIDATION", "อีเมลหรือรหัสผ่านไม่ถูกต้อง", 422);
    }

    return ok({ signedIn: true });
  });
}
