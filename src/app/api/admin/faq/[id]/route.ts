import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { faqItemSchema } from "@/lib/admin-schemas";
import {
  deleteFaqItem,
  publishFaqItem,
  saveFaqDraft,
  updateFaqMeta,
} from "@/server/admin/cms-content-admin-service";

/** PATCH /api/admin/faq/:id — meta only (enabled, category, sortOrder) */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const data = faqItemSchema.partial().pick({ category: true, enabled: true, sortOrder: true }).parse(
      await req.json(),
    );
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    return ok(await updateFaqMeta(id, data, { id: admin.id, ip }));
  });
}

/** DELETE /api/admin/faq/:id */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    return ok(await deleteFaqItem(id, { id: admin.id, ip }));
  });
}

/** PUT /api/admin/faq/:id — save draft (Q/A + meta) */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const data = faqItemSchema.parse(await req.json());
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    return ok(await saveFaqDraft(id, data, { id: admin.id, ip }));
  });
}

/** POST /api/admin/faq/:id/publish */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const data = faqItemSchema.parse(await req.json());
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    return ok(await publishFaqItem(id, data, { id: admin.id, ip }));
  });
}
