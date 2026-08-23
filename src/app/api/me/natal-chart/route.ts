import { handle, ok } from "@/lib/http";
import { requireUser } from "@/server/auth/rbac";
import { getNatalChart } from "@/server/horoscope/natal-chart-service";
import { requireReadyNatalChart } from "@/server/horoscope/chart-context";

/** Return a usable saved chart; repairs missing/stale charts synchronously. */
export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    await requireReadyNatalChart(user.id);
    const chart = await getNatalChart(user.id);
    return ok({ chart });
  });
}
