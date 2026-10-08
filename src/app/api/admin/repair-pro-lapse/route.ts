import { handle, ok } from "@/lib/http";
import { requireSuperAdmin } from "@/server/auth/rbac";
import { repairProLapse } from "@/server/admin/repair-pro-lapse-service";
import { clientIp } from "@/lib/rate-limit";

/** GET — which paying Pro wallets the 1 Oct lapse cut (no changes). */
export async function GET() {
  return handle(async () => {
    await requireSuperAdmin();
    return ok(await repairProLapse({ apply: false }));
  });
}

/** POST — give the usage back (super admin, audited, idempotent). */
export async function POST(req: Request) {
  return handle(async () => {
    const admin = await requireSuperAdmin();
    return ok(await repairProLapse({ apply: true, actorId: admin.id, ip: clientIp(req) }));
  });
}
