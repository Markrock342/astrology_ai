import { handle, ok } from "@/lib/http";
import { requireAdmin, requireSuperAdmin } from "@/server/auth/rbac";
import { createStaffUserSchema, userListQuerySchema } from "@/lib/admin-schemas";
import { createStaffUser, listUsers } from "@/server/admin/user-admin-service";

/** GET /api/admin/users — paginated + searchable + filterable user list. */
export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const q = userListQuerySchema.parse(Object.fromEntries(searchParams));
    return ok(await listUsers(q));
  });
}

/** POST /api/admin/users — create a new ADMIN / SUPER_ADMIN login. */
export async function POST(req: Request) {
  return handle(async () => {
    const admin = await requireSuperAdmin();
    const data = createStaffUserSchema.parse(await req.json());
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    return ok(
      await createStaffUser(data, { id: admin.id, role: admin.role, ip }),
      { status: 201 },
    );
  });
}
