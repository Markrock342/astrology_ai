import { handle, ok } from "@/lib/http";
import { AppError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { requireAdmin } from "@/server/auth/rbac";
import {
  beginTotpEnrollment,
  confirmTotpEnrollment,
  getAdmin2faStatus,
  verifyTotpLogin,
} from "@/server/auth/admin-2fa-service";
import { z } from "zod";

const codeSchema = z.object({
  code: z.string().min(6).max(64),
});

/** GET /api/admin/2fa — enrollment + cookie verification status. */
export async function GET() {
  return handle(async () => {
    const admin = await requireAdmin({ skip2fa: true });
    return ok(await getAdmin2faStatus(admin.id));
  });
}

/** POST /api/admin/2fa — begin enrollment | confirm | verify login. */
export async function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin({ skip2fa: true });
    const body = (await req.json()) as { action?: string; code?: string };
    const action = body.action ?? "verify";
    const ip = req.headers.get("x-forwarded-for") ?? undefined;

    if (action === "begin") {
      return ok(await beginTotpEnrollment(admin.id));
    }
    if (action === "confirm") {
      // Throttle code submission — without this the 6-digit TOTP / 32-bit backup
      // codes are brute-forceable by anyone holding a stolen admin session.
      await rateLimit(`2fa-code:${admin.id}`, 8, 5 * 60_000);
      const { code } = codeSchema.parse(body);
      return ok(await confirmTotpEnrollment(admin.id, code, ip));
    }
    if (action === "verify") {
      await rateLimit(`2fa-code:${admin.id}`, 8, 5 * 60_000);
      const { code } = codeSchema.parse(body);
      await verifyTotpLogin(admin.id, code);
      return ok({ verified: true });
    }
    throw new AppError("VALIDATION", "Unknown 2FA action");
  });
}
