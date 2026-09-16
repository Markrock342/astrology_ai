import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { listQuerySchema } from "@/lib/admin-schemas";
import { listReadingTraces } from "@/server/admin/reading-trace-admin-service";

/** GET /api/admin/readings — readings with what the model was given + a quick verdict. */
export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const q = listQuerySchema.parse(Object.fromEntries(searchParams));
    return ok(await listReadingTraces(q));
  });
}
