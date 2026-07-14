import { z } from "zod";
import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { listFeedbackForAdmin } from "@/server/horoscope/feedback-service";

const querySchema = z.object({
  value: z.enum(["UP", "DOWN"]).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
});

const PAGE_SIZE = 20;

/** GET /api/admin/feedback — what users actually thought of the answers. */
export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const { value, page } = querySchema.parse(
      Object.fromEntries(searchParams),
    );
    return ok(
      await listFeedbackForAdmin({ value, page, pageSize: PAGE_SIZE }),
    );
  });
}
