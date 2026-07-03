import { handle, ok } from "@/lib/http";
import { requireUser } from "@/server/auth/rbac";
import { getNatalChart } from "@/server/horoscope/natal-chart-service";

/** Natal chart computation status for the current user (stub until engine ships). */
export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const chart = await getNatalChart(user.id);
    return ok({ chart });
  });
}
