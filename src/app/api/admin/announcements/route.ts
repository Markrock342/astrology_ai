import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { announcementSchema } from "@/lib/admin-schemas";
import {
  createAnnouncement,
  listAnnouncements,
} from "@/server/admin/cms-content-admin-service";

/** GET /api/admin/announcements */
export async function GET() {
  return handle(async () => {
    await requireAdmin();
    const rows = await listAnnouncements();
    return ok(
      rows.map((r) => ({
        ...r,
        startsAt: r.startsAt?.toISOString() ?? null,
        endsAt: r.endsAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    );
  });
}

/** POST /api/admin/announcements */
export async function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    const data = announcementSchema.parse(await req.json());
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    const created = await createAnnouncement(
      {
        ...data,
        linkUrl: data.linkUrl || null,
        linkLabel: data.linkLabel || null,
      },
      { id: admin.id, ip },
    );
    return ok(created, { status: 201 });
  });
}
