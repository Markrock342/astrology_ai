import bcrypt from "bcryptjs";
import { prisma } from "@/server/db";
import { registerSchema } from "@/lib/schemas";
import { handle, ok, fail } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { addCredits } from "@/server/credit/credit-service";
import { DEFAULTS } from "@/config/constants";

/**
 * Register a new local user. Creates the user, a credit wallet with the Free
 * grant, and a default Free subscription — all in one transaction. Password is
 * hashed; never stored or logged in plain text.
 */
export async function POST(req: Request) {
  return handle(async () => {
    rateLimit(`register:${req.headers.get("x-forwarded-for") ?? "local"}`, 5, 60_000);

    const body = await req.json();
    const data = registerSchema.parse(body);

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) return fail("VALIDATION", "อีเมลนี้ถูกใช้งานแล้ว", 422);

    const passwordHash = await bcrypt.hash(data.password, 10);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { name: data.name, email: data.email, passwordHash, role: "USER" },
      });
      await tx.creditWallet.create({ data: { userId: created.id, balance: 0 } });

      const freePkg = await tx.package.findUnique({ where: { code: "FREE" } });
      if (freePkg) {
        await tx.userSubscription.create({
          data: {
            userId: created.id,
            packageId: freePkg.id,
            status: "ACTIVE",
            activationSource: "SYSTEM_DEFAULT",
          },
        });
      }
      return created;
    });

    // Initial free credit grant (immutable ledger entry).
    await addCredits(user.id, DEFAULTS.freeCreditQuota, {
      type: "INITIAL_GRANT",
      note: "Free sign-up grant",
    });

    return ok({ id: user.id, email: user.email }, { status: 201 });
  });
}
