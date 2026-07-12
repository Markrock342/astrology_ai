import { handle, ok } from "@/lib/http";
import { submitPaymentSchema } from "@/lib/admin-schemas";
import { rateLimit } from "@/lib/rate-limit";
import { requireUser } from "@/server/auth/rbac";
import { submitManualPayment } from "@/server/payment/payment-service";

/** POST /api/payments/manual — user submits a manual payment request. */
export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    await rateLimit(`payment-manual:${user.id}`, 5, 60_000);
    const data = submitPaymentSchema.parse(await req.json());
    return ok(await submitManualPayment(user.id, data), { status: 201 });
  });
}
