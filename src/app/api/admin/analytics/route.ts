import { z } from "zod";
import { handle, ok } from "@/lib/http";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/auth/rbac";
import { bangkokBoundaries } from "@/server/credit/quota-service";
import { estimateCostUsd, USD_TO_THB } from "@/config/ai-pricing";

const querySchema = z.object({
  days: z.coerce.number().int().min(7).max(31).optional().default(14),
});

const BKK_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Bangkok calendar date (YYYY-MM-DD) for a UTC timestamp. */
function bkkDay(d: Date): string {
  return new Date(d.getTime() + BKK_OFFSET_MS).toISOString().slice(0, 10);
}

export type AnalyticsDay = {
  day: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  calls: number;
  failures: number;
};

/**
 * GET /api/admin/analytics — daily token/cost/traffic series for the dashboard.
 *
 * The client polls this every 30s, so it must stay one cheap indexed scan:
 * everything is bucketed here in one pass, no per-day queries.
 */
export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const { days } = querySchema.parse(Object.fromEntries(searchParams));

    const now = new Date();
    const { dayStart } = bangkokBoundaries(now);
    const since = new Date(dayStart.getTime() - (days - 1) * 24 * 60 * 60 * 1000);

    const logs = await prisma.aIUsageLog.findMany({
      where: { createdAt: { gte: since } },
      select: {
        createdAt: true,
        status: true,
        errorCode: true,
        modelId: true,
        inputUsage: true,
        outputUsage: true,
        estimatedCost: true,
        userId: true,
      },
    });

    // Pre-seed every day so quiet days plot as zero instead of vanishing —
    // a missing day reads as "no data", a zero day reads as "no traffic".
    const byDay = new Map<string, AnalyticsDay>();
    for (let i = 0; i < days; i++) {
      const d = bkkDay(new Date(since.getTime() + i * 24 * 60 * 60 * 1000));
      byDay.set(d, { day: d, inputTokens: 0, outputTokens: 0, costUsd: 0, calls: 0, failures: 0 });
    }

    const todayKey = bkkDay(now);
    const activeUsersToday = new Set<string>();

    for (const log of logs) {
      const bucket = byDay.get(bkkDay(log.createdAt));
      if (!bucket) continue;
      // RESERVED rows are in-flight, not usage yet.
      if (log.status === "RESERVED") continue;

      bucket.calls += 1;
      bucket.inputTokens += log.inputUsage ?? 0;
      bucket.outputTokens += log.outputUsage ?? 0;
      bucket.costUsd +=
        log.estimatedCost != null
          ? Number(log.estimatedCost)
          : estimateCostUsd(log.modelId, log.inputUsage, log.outputUsage);
      // A user stopping their own answer is not a system failure.
      if (
        (log.status === "FAILED" || log.status === "TIMEOUT") &&
        log.errorCode !== "STOPPED"
      ) {
        bucket.failures += 1;
      }
      if (bkkDay(log.createdAt) === todayKey) activeUsersToday.add(log.userId);
    }

    const series = [...byDay.values()];
    const today = byDay.get(todayKey) ?? null;

    return ok({
      generatedAt: now.toISOString(),
      usdToThb: USD_TO_THB,
      days,
      series,
      today: {
        ...(today ?? {
          day: todayKey,
          inputTokens: 0,
          outputTokens: 0,
          costUsd: 0,
          calls: 0,
          failures: 0,
        }),
        activeUsers: activeUsersToday.size,
      },
    });
  });
}
