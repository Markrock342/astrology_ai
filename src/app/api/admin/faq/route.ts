import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { faqItemSchema } from "@/lib/admin-schemas";
import {
  createFaqItem,
  listFaqItemsAdmin,
  seedDefaultFaqIfEmpty,
} from "@/server/admin/cms-content-admin-service";

/** GET /api/admin/faq */
export async function GET() {
  return handle(async () => {
    await requireAdmin();
    await seedDefaultFaqIfEmpty();
    const rows = await listFaqItemsAdmin();
    return ok(
      rows.map((r) => ({
        ...r,
        draftUpdatedAt: r.draftUpdatedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        // The list query no longer selects the draft bodies (they are large);
        // draftUpdatedAt is set on save and cleared on publish, so it is the
        // cheap equivalent of "a draft exists".
        hasDraft: r.draftUpdatedAt != null,
      })),
    );
  });
}

/** POST /api/admin/faq */
export async function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    const data = faqItemSchema.parse(await req.json());
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    return ok(await createFaqItem(data, { id: admin.id, ip }), { status: 201 });
  });
}
