import { after } from "next/server";
import { prisma } from "@/server/db";
import { rateLimit } from "@/lib/rate-limit";
import { birthProfileToChartInput } from "@/server/horoscope/engine/birth-input-mapper";
import {
  computeNatalChart,
  computeNatalChartFormula,
} from "@/server/horoscope/engine/compute-chart";
import { upsertChartMemory } from "@/server/horoscope/chart-memory-service";
import { withPrismaRetry } from "@/server/prisma-utils";

/**
 * Keep the instance alive until the task settles. A bare `void promise` is
 * killed once the serverless response is sent, which is how background scrape
 * upgrades silently stopped landing in production.
 */
function runAfterResponse(task: () => Promise<void>) {
  try {
    after(task);
  } catch {
    // No request scope (scripts, tests) — nothing to outlive, so just run it.
    void task();
  }
}

/**
 * Save a fast local formula chart immediately, then optionally upgrade via myhora.
 * Chat must never wait on scrape. Also refreshes UserChartMemory.
 */
export async function queueNatalChart(userId: string, birthProfileId: string) {
  const profile = await withPrismaRetry(() =>
    prisma.birthProfile.findUnique({ where: { id: birthProfileId } }),
  );
  if (!profile) return;

  const input = birthProfileToChartInput(profile);
  const formula = computeNatalChartFormula(input);

  await withPrismaRetry(() =>
    prisma.natalChart.upsert({
      where: { userId },
      create: {
        userId,
        birthProfileId,
        status: "READY",
        chartJson: formula as object,
        note: formula.meta.calculationSource ?? "formula-pipeline",
        computedAt: new Date(),
      },
      update: {
        birthProfileId,
        status: "READY",
        chartJson: formula as object,
        note: formula.meta.calculationSource ?? "formula-pipeline",
        computedAt: new Date(),
      },
    }),
  );

  await upsertChartMemory(userId, formula).catch((err) => {
    console.warn(
      "[natal] chart memory upsert failed:",
      err instanceof Error ? err.message : err,
    );
  });

  runAfterResponse(() =>
    upgradeNatalChartFromScrape(userId, birthProfileId).catch((err) => {
      console.warn(
        "[natal] scrape upgrade failed:",
        err instanceof Error ? err.message : err,
      );
    }),
  );
}

/** Replace READY formula chart with myhora scrape when available (non-blocking caller). */
export async function upgradeNatalChartFromScrape(
  userId: string,
  birthProfileId: string,
) {
  const profile = await withPrismaRetry(() =>
    prisma.birthProfile.findUnique({ where: { id: birthProfileId } }),
  );
  if (!profile) return;

  const input = birthProfileToChartInput(profile);
  // Hard cap so background work cannot run forever on serverless. The scrape
  // itself holds no DB connection, so a slow myhora cannot starve the pool.
  const chartJson = await computeNatalChart(input, { scrapeTimeoutMs: 12_000 });

  await withPrismaRetry(() =>
    prisma.natalChart.update({
      where: { userId },
      data: {
        birthProfileId,
        status: "READY",
        chartJson: chartJson as object,
        note:
          chartJson.meta.calculationSource === "myhora-scrape"
            ? null
            : "formula-pipeline",
        computedAt: new Date(),
      },
    }),
  );

  await upsertChartMemory(userId, chartJson);
}

export async function getNatalChart(userId: string) {
  return withPrismaRetry(() =>
    prisma.natalChart.findUnique({ where: { userId } }),
  );
}

export async function recomputeNatalChart(userId: string) {
  rateLimit(`natal-recompute:${userId}`, 5, 60_000);
  const profile = await withPrismaRetry(() =>
    prisma.birthProfile.findUnique({ where: { userId } }),
  );
  if (!profile) return null;
  await queueNatalChart(userId, profile.id);
  return getNatalChart(userId);
}
