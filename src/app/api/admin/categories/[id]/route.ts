import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { categoryUpdateSchema } from "@/lib/admin-schemas";
import {
  getCategory,
  updateCategory,
  deleteCategory,
} from "@/server/admin/catalog-admin-service";

/** GET /api/admin/categories/:id */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await ctx.params;
    return ok(await getCategory(id));
  });
}

/** PATCH /api/admin/categories/:id — update a category (audited). */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const data = categoryUpdateSchema.parse(await req.json());
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    return ok(await updateCategory(id, data, { id: admin.id, ip }));
  });
}

/** DELETE /api/admin/categories/:id — delete if unused, else disable (audited). */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    return ok(await deleteCategory(id, { id: admin.id, ip }));
  });
}
