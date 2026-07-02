import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { packageCreateSchema } from "@/lib/admin-schemas";
import { listPackages, createPackage } from "@/server/admin/catalog-admin-service";

/** GET /api/admin/packages — all packages. */
export async function GET() {
  return handle(async () => {
    await requireAdmin();
    return ok(await listPackages());
  });
}

/** POST /api/admin/packages — create a package (audited). */
export async function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    const data = packageCreateSchema.parse(await req.json());
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    return ok(await createPackage(data, { id: admin.id, ip }), { status: 201 });
  });
}
