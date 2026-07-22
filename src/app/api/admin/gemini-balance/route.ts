import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { geminiBalanceUpdateSchema } from "@/lib/admin-schemas";
import {
  getGeminiBalance,
  updateGeminiBalance,
} from "@/server/admin/gemini-balance-service";

/** GET /api/admin/gemini-balance — Prepay snapshot + estimated remaining. */
export async function GET() {
  return handle(async () => {
    await requireAdmin();
    return ok(await getGeminiBalance());
  });
}

/** PUT /api/admin/gemini-balance — set / update / clear tracked Prepay balance. */
export async function PUT(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    const data = geminiBalanceUpdateSchema.parse(await req.json());
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    return ok(
      await updateGeminiBalance(
        {
          balanceUsd: data.balanceUsd,
          clear: data.clear,
          lowThresholdUsd: data.lowThresholdUsd,
          note: data.note,
        },
        { id: admin.id, ip },
      ),
    );
  });
}
