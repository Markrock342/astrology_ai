import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { astrologyStandardTermSchema } from "@/lib/admin-schemas";
import {
  deleteAstrologyStandard,
  updateAstrologyStandard,
} from "@/server/admin/astrology-standard-admin-service";

/** PUT /api/admin/astrology-standards/:id */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const data = astrologyStandardTermSchema.parse(await req.json());
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    return ok(await updateAstrologyStandard(id, data, { id: admin.id, ip }));
  });
}

/** DELETE /api/admin/astrology-standards/:id */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    return ok(await deleteAstrologyStandard(id, { id: admin.id, ip }));
  });
}
