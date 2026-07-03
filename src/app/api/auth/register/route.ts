import bcrypt from "bcryptjs";
import { prisma } from "@/server/db";
import { registerSchema } from "@/lib/schemas";
import { handle, ok, fail } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { provisionUser } from "@/server/auth/provisioning";
import { normalizeEmail } from "@/server/auth/account-lookup";

/**
 * Register a new local user. Provisioning (user + wallet + Free subscription +
 * initial credit grant) is shared with first-time Google sign-in. Password is
 * hashed; never stored or logged in plain text.
 */
export async function POST(req: Request) {
  return handle(async () => {
    rateLimit(`register:${req.headers.get("x-forwarded-for") ?? "local"}`, 10, 60_000);

    const body = await req.json();
    const data = registerSchema.parse(body);
    const email = normalizeEmail(data.email);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return fail("VALIDATION", "อีเมลนี้ถูกใช้งานแล้ว", 422);

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await provisionUser({
      email,
      name: data.name,
      passwordHash,
    });

    return ok({ id: user.id, email: user.email }, { status: 201 });
  });
}
