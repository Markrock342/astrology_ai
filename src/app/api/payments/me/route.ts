import { handle, ok } from "@/lib/http";
import { requireUser } from "@/server/auth/rbac";
import { listMyPayments } from "@/server/payment/payment-service";

/** GET /api/payments/me — current user's payment history. */
export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    return ok(await listMyPayments(user.id));
  });
}
