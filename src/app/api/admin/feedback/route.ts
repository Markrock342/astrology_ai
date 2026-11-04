import { after } from "next/server";
import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { getChatInsights, runChatInsights, startChatInsights } from "@/server/admin/chat-insights-service";
import { clientIp, rateLimit } from "@/lib/rate-limit";
export const maxDuration = 1800;
export async function GET() {
  return handle(async () => {
    await requireAdmin();
    return ok(await getChatInsights(), { headers: { "Cache-Control": "private, no-store" } });
  });
}
export async function POST(req: Request) {
  return handle(async () => {
    const actor = await requireAdmin();
    await rateLimit(`chat-insights:${actor.id}`, 1, 300000);
    const job = await startChatInsights({ id: actor.id, ip: clientIp(req) });
    after(() => runChatInsights(job, actor.id));
    return ok(job, { status: 202 });
  });
}
