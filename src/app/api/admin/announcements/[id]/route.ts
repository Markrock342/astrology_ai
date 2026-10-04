import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { announcementSchema, partialNoDefaults } from "@/lib/admin-schemas";
import {
  deleteAnnouncement,
  updateAnnouncement,
} from "@/server/admin/cms-content-admin-service";
import { clientIp } from "@/lib/rate-limit";

/** PATCH /api/admin/announcements/:id */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const data = partialNoDefaults(announcementSchema).parse(await req.json());
    const ip = clientIp(req);
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
    const ip = clientIp(req);
    return ok(await deleteAnnouncement(id, { id: admin.id, ip }));
  });
}
