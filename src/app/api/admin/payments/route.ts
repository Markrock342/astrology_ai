import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { paymentListQuerySchema } from "@/lib/admin-schemas";
import { listPayments } from "@/server/payment/payment-service";

/** GET /api/admin/payments — paginated payment requests for admin review. */
export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const q = paymentListQuerySchema.parse(Object.fromEntries(searchParams));
    return ok(await listPayments(q));
  });
}
