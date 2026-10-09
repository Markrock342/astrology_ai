import { handle, ok } from "@/lib/http";
import { requireUser } from "@/server/auth/rbac";
import { pollNatalChartStatus } from "@/server/horoscope/natal-chart-service";

/**
 * Natal chart status for the app's poll. Rebuilds only when no build is
 * running and a failure is not fresh; `?retry=1` is the retry button.
 */
export async function GET(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const retry = new URL(req.url).searchParams.get("retry") === "1";
    return ok(await pollNatalChartStatus(user.id, { retry }));
  });
}
