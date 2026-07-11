import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { paymentReviewSchema } from "@/lib/admin-schemas";
import { reviewPayment } from "@/server/payment/payment-service";

/** PATCH /api/admin/payments/:id/review — approve or reject a payment (audited). */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const data = paymentReviewSchema.parse(await req.json());
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    return ok(await reviewPayment(id, data, { id: admin.id, ip }));
  });
}
