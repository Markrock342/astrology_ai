import { z } from "zod";
import { handle, ok } from "@/lib/http";
import { requireUser } from "@/server/auth/rbac";
import { getMyUsage, getMyUsageSummary } from "@/server/account/usage-service";

const usageQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  view: z.enum(["summary", "full"]).optional(),
});

/** GET /api/me/usage — balance, plan limits, usage counts, credit history. */
export async function GET(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const q = usageQuerySchema.parse(Object.fromEntries(searchParams));
    if (q.view === "summary") {
      return ok(await getMyUsageSummary(user.id));
    }
    return ok(await getMyUsage(user.id, q.cursor));
  });
}
