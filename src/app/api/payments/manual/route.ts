import { handle, ok } from "@/lib/http";
import { submitPaymentSchema } from "@/lib/admin-schemas";
import { requireUser } from "@/server/auth/rbac";
import { submitManualPayment } from "@/server/payment/payment-service";

/** POST /api/payments/manual — user submits a manual payment request. */
export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const data = submitPaymentSchema.parse(await req.json());
    return ok(
      await submitManualPayment(user.id, {
        ...data,
        proofUrl: data.proofUrl || undefined,
      }),
      { status: 201 },
    );
  });
}
