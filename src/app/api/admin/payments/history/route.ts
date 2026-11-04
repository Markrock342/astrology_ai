import { handle, ok } from "@/lib/http";
import { paymentHistoryQuerySchema } from "@/lib/admin-schemas";
import { requireAdmin } from "@/server/auth/rbac";
import { listPaymentHistory } from "@/server/payment/payment-history-service";

export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const query = paymentHistoryQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
    return ok(await listPaymentHistory(query), { headers: { "Cache-Control": "private, no-store" } });
  });
}
