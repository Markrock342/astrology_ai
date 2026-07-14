import { z } from "zod";
import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { getCostSummary } from "@/server/admin/cost-admin-service";

const querySchema = z.object({
  months: z.coerce.number().int().min(0).max(11).optional().default(0),
});

/** GET /api/admin/costs — what each user costs to serve vs what they pay. */
export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const { months } = querySchema.parse(Object.fromEntries(searchParams));
    return ok(await getCostSummary(months));
  });
}
