import bcrypt from "bcryptjs";
import { prisma } from "@/server/db";
import { registerSchema } from "@/lib/schemas";
import { handle, ok, fail } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { provisionUser } from "@/server/auth/provisioning";
import { normalizeEmail } from "@/server/auth/account-lookup";
import { sendVerificationEmail } from "@/server/auth/email-verification-service";
import { verifyTurnstile, clientIp } from "@/server/auth/turnstile";
import { signInCredentials } from "@/server/auth/server-sign-in";

/**
 * Register a new local user. Provisioning (user + wallet + Free subscription +
 * initial credit grant) is shared with first-time Google sign-in. Password is
 * hashed; never stored or logged in plain text.
 *
 * Signs the user in on the server in the same request so the client avoids a
 * second round-trip to /api/auth (saves cold-start latency on Vercel).
 */
export async function POST(req: Request) {
  return handle(async () => {
    rateLimit(`register:${req.headers.get("x-forwarded-for") ?? "local"}`, 10, 60_000);

    const body = await req.json();
    const data = registerSchema.parse(body);
    await verifyTurnstile(data.turnstileToken, clientIp(req));

    const email = normalizeEmail(data.email);
    const password = data.password;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return fail("VALIDATION", "อีเมลนี้ถูกใช้งานแล้ว", 422);

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await provisionUser({
      email,
      name: data.name,
      passwordHash,
    });

    await sendVerificationEmail(user.id);

    const signedIn = await signInCredentials(email, password);

    if (signedIn === "invalid") {
      return ok(
        {
          id: user.id,
          email: user.email,
          signedIn: false,
          emailVerificationSent: true,
        },
        { status: 201 },
      );
    }

    return ok(
      {
        id: user.id,
        email: user.email,
        signedIn: true,
        emailVerificationSent: true,
      },
      { status: 201 },
    );
  });
}
