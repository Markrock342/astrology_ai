import bcrypt from "bcryptjs";
import { prisma } from "@/server/db";
import { loginSchema } from "@/lib/schemas";
import { handle, ok, fail } from "@/lib/http";
import { AppError } from "@/lib/errors";
import { rateLimit, rateLimitIp } from "@/lib/rate-limit";
import { normalizeEmail } from "@/server/auth/account-lookup";
import { signInCredentials } from "@/server/auth/server-sign-in";

const WRONG_CREDENTIALS = "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
const ACCOUNT_WINDOW_MS = 15 * 60_000;

function tooManyAttempts(retryAfterSeconds: number): Response {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  const res = fail(
    "RATE_LIMITED",
    `ลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอประมาณ ${minutes} นาทีแล้วลองใหม่`,
    429,
    { retryAfterSeconds },
  );
  res.headers.set("Retry-After", String(retryAfterSeconds));
  return res;
}

/**
 * Credentials login — rate-limited, no Turnstile (world-class: captcha on
 * register/forgot/resend only; login protected by rate limit + bcrypt).
 *
 * Status codes: 401 wrong email/password, 429 too many attempts (with
 * Retry-After), 422 malformed body. Both of the first two used to come back
 * as 422 or — when Auth.js's own per-account limiter refused a correct
 * password — as a 500 "temporary error" that told the user nothing.
 */
export async function POST(req: Request) {
  return handle(async () => {
    await rateLimit(
      `login:${rateLimitIp(req)}`,
      20,
      60_000,
      { failClosed: true, requireDistributed: true },
    );

    const body = await req.json();
    const data = loginSchema.parse(body);
    const email = normalizeEmail(data.email);

    // Per account, across IPs: the IP limit alone let a botnet guess one
    // account's password at 20 tries per minute per address.
    try {
      await rateLimit(`login-acct:${email}`, 10, ACCOUNT_WINDOW_MS, { failClosed: true });
    } catch (err) {
      if (err instanceof AppError && err.code === "RATE_LIMITED") {
        const retry = (err.details as { retryAfterSeconds?: number } | undefined)?.retryAfterSeconds;
        return tooManyAttempts(retry ?? ACCOUNT_WINDOW_MS / 1000);
      }
      throw err;
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) return fail("UNAUTHENTICATED", WRONG_CREDENTIALS, 401);
    if (!user.passwordHash) {
      return fail(
        "UNAUTHENTICATED",
        "บัญชีนี้สมัครด้วย Google — กรุณาใช้ปุ่มเข้าสู่ระบบด้วย Google",
        401,
      );
    }
    if (user.status === "DISABLED") {
      return fail("UNAUTHENTICATED", WRONG_CREDENTIALS, 401);
    }

    const valid = await bcrypt.compare(data.password, user.passwordHash);
    if (!valid) return fail("UNAUTHENTICATED", WRONG_CREDENTIALS, 401);

    const signedIn = await signInCredentials(email, data.password);
    if (signedIn === "invalid") {
      // The password was just verified above, so Auth.js refused for its own
      // reason: the authorize() limiter (config.ts, 10 per account / 15 min).
      return tooManyAttempts(ACCOUNT_WINDOW_MS / 1000);
    }

    return ok({ signedIn: true });
  });
}
