import { z } from "zod";
import { handle } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { EXPIRY_FILTERS, EXPORT_RANGES } from "@/lib/member-export";
import { exportMembers } from "@/server/admin/member-export-service";
const query = z.object({ range: z.enum(EXPORT_RANGES), search: z.string().trim().max(200).optional(), status: z.enum(["ACTIVE", "DISABLED"]).optional(), expiry: z.enum(EXPIRY_FILTERS).default("all") });
export async function GET(req: Request) {
  return handle(async () => {
    const actor = await requireAdmin();
    await rateLimit(`member-export:${actor.id}`, 3, 60000);
    const { range, ...filters } = query.parse(Object.fromEntries(new URL(req.url).searchParams));
    const csv = await exportMembers(range, { id: actor.id, ip: clientIp(req) }, filters);
    return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="horasard-members-signup-${range}${filters.expiry !== "all" ? `-${filters.expiry}` : ""}.csv"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  });
}
