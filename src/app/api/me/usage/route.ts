import { z } from "zod";
import { handle, ok } from "@/lib/http";
import { requireUser } from "@/server/auth/rbac";
import { getMyUsage } from "@/server/account/usage-service";

const usageQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
});

/** GET /api/me/usage — balance, plan limits, usage counts, credit history. */
export async function GET(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const q = usageQuerySchema.parse(Object.fromEntries(searchParams));
    return ok(await getMyUsage(user.id, q.cursor));
  });
}
