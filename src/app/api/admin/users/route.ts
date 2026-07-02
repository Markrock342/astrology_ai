import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { userListQuerySchema } from "@/lib/admin-schemas";
import { listUsers } from "@/server/admin/user-admin-service";

/** GET /api/admin/users — paginated + searchable + filterable user list. */
export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const q = userListQuerySchema.parse(Object.fromEntries(searchParams));
    return ok(await listUsers(q));
  });
}
