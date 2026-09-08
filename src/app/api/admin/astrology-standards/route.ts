import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { astrologyStandardTermSchema } from "@/lib/admin-schemas";
import {
  createAstrologyStandard,
  listAstrologyStandardsAdmin,
  seedDefaultAstrologyStandardsIfEmpty,
} from "@/server/admin/astrology-standard-admin-service";

/** GET /api/admin/astrology-standards */
export async function GET() {
  return handle(async () => {
    await requireAdmin();
    await seedDefaultAstrologyStandardsIfEmpty();
    const rows = await listAstrologyStandardsAdmin();
    return ok(
      rows.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
    );
  });
}

/** POST /api/admin/astrology-standards */
export async function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    const data = astrologyStandardTermSchema.parse(await req.json());
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    return ok(await createAstrologyStandard(data, { id: admin.id, ip }), { status: 201 });
  });
}
