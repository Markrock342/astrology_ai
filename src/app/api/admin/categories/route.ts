import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { categoryCreateSchema } from "@/lib/admin-schemas";
import { listCategories, createCategory } from "@/server/admin/catalog-admin-service";

/** GET /api/admin/categories — all categories (including disabled). */
export async function GET() {
  return handle(async () => {
    await requireAdmin();
    return ok(await listCategories());
  });
}

/** POST /api/admin/categories — create a category (audited). */
export async function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    const data = categoryCreateSchema.parse(await req.json());
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    return ok(await createCategory(data, { id: admin.id, ip }), { status: 201 });
  });
}
