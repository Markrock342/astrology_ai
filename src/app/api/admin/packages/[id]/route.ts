import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { packageUpdateSchema } from "@/lib/admin-schemas";
import { getPackage, updatePackage, deletePackage } from "@/server/admin/catalog-admin-service";

/** GET /api/admin/packages/:id */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await ctx.params;
    return ok(await getPackage(id));
  });
}

/** PATCH /api/admin/packages/:id — update a package (audited). */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const data = packageUpdateSchema.parse(await req.json());
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    return ok(await updatePackage(id, data, { id: admin.id, ip }));
  });
}

/** DELETE /api/admin/packages/:id — delete if unused, else disable (audited). */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    return ok(await deletePackage(id, { id: admin.id, ip }));
  });
}
