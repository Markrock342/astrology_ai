import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { announcementSchema } from "@/lib/admin-schemas";
import {
  deleteAnnouncement,
  updateAnnouncement,
} from "@/server/admin/cms-content-admin-service";

/** PATCH /api/admin/announcements/:id */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const data = announcementSchema.partial().parse(await req.json());
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    return ok(
      await updateAnnouncement(
        id,
        {
          ...data,
          linkUrl: data.linkUrl === "" ? null : data.linkUrl,
          linkLabel: data.linkLabel === "" ? null : data.linkLabel,
        },
        { id: admin.id, ip },
      ),
    );
  });
}

/** DELETE /api/admin/announcements/:id */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    return ok(await deleteAnnouncement(id, { id: admin.id, ip }));
  });
}
