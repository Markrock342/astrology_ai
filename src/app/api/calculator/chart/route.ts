import { handle, ok } from "@/lib/http";
import { rateLimit, rateLimitIp } from "@/lib/rate-limit";
import { birthProfileSchema } from "@/lib/schemas";
import { computePublicNatalChart } from "@/server/horoscope/public-chart-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public natal calculator — formula engine only, nothing persisted. */
export async function POST(req: Request) {
  return handle(async () => {
    await rateLimit(`calculator:${rateLimitIp(req)}`, 20, 60_000);
    const input = birthProfileSchema.parse(await req.json());
    return ok({ chart: await computePublicNatalChart(input) });
  });
}
