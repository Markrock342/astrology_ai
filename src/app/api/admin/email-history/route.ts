import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { emailHistoryQuery, listEmailHistory } from "@/server/email/delivery-history";
export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
    return ok(await listEmailHistory(emailHistoryQuery.parse(Object.fromEntries(new URL(req.url).searchParams))));
  });
}
