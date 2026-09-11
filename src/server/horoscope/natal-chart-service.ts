import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { isCurrentTaksaSlots } from "@/lib/taksa";
import type { BirthInputSnapshot, ChartJson } from "@/types/chart";
import {
  birthProfileToChartInput,
  chartInputMatches,
} from "@/server/horoscope/engine/birth-input-mapper";
import { computeNatalChart } from "@/server/horoscope/engine/compute-chart";
import { upsertChartMemory } from "@/server/horoscope/chart-memory-service";
import { withPrismaRetry } from "@/server/prisma-utils";
import { invalidateUserBootstrap } from "@/server/app/bootstrap-cache";

const DEFAULT_SCRAPE_TIMEOUT_MS = 20_000;

function scrapeTimeoutMs(): number {
  const configured = Number(process.env.MYHORA_SCRAPE_TIMEOUT_MS);
  return configured > 0 ? configured : DEFAULT_SCRAPE_TIMEOUT_MS;
}

function isUsableChart(chart: ChartJson | null | undefined): chart is ChartJson {
  if (!chart) return false;
  const lagna = chart.chart?.lagna ?? chart.meta?.lagna;
  return Boolean(lagna && Array.isArray(chart.planets) && chart.planets.length >= 7);
}

function isAcceptableCachedChart(
  chart: ChartJson,
  input: BirthInputSnapshot,
): boolean {
  return (
    chartInputMatches(chart.input, input) &&
    chart.meta?.evidenceVersion === 2 &&
    chart.settings?.taksaCountFrom === "birth-weekday" &&
    isCurrentTaksaSlots(chart.chart?.taksa) &&
    isUsableChart(chart)
  );
}

async function loadReadyChart(userId: string): Promise<ChartJson | null> {
  const row = await withPrismaRetry(() =>
    prisma.natalChart.findUnique({
      where: { userId },
      select: { status: true, chartJson: true },
    }),
  );
  if (!row || row.status !== "READY" || !row.chartJson) return null;
  const chart = row.chartJson as unknown as ChartJson;
  return isUsableChart(chart) ? chart : null;
}

async function persistReadyChart(
  userId: string,
  birthProfileId: string,
  chartJson: ChartJson,
) {
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

  await upsertChartMemory(userId, chartJson).catch((err) => {
    console.warn(
      "[natal] chart memory upsert failed:",
      err instanceof Error ? err.message : err,
    );
  });
  invalidateUserBootstrap(userId);
}

/**
 * Scrape myhora first on every build. Falls back to local formula only when the
 * scrape fails or times out. Reuses a fresh myhora chart when birth input matches.
 */
export async function buildNatalChartScrapeFirst(
  userId: string,
  birthProfileId: string,
  input: BirthInputSnapshot,
  options?: { scrapeTimeoutMs?: number },
): Promise<ChartJson> {
  const timeout = options?.scrapeTimeoutMs ?? scrapeTimeoutMs();

  await withPrismaRetry(() =>
    prisma.natalChart.upsert({
      where: { userId },
      create: { userId, birthProfileId, status: "PENDING" },
      update: { birthProfileId, status: "PENDING" },
    }),
  );
  invalidateUserBootstrap(userId);

  try {
    const chartJson = await computeNatalChart(input, { scrapeTimeoutMs: timeout });
    if (!isUsableChart(chartJson)) {
      throw new AppError(
        "CHART_NOT_READY",
        "ยังไม่มีพื้นดวงจาก engine — กรุณาบันทึกวันเกิดใหม่แล้วลองอีกครั้ง",
      );
    }

    await persistReadyChart(userId, birthProfileId, chartJson);
    return chartJson;
  } catch (err) {
    await withPrismaRetry(() =>
      prisma.natalChart
        .update({
          where: { userId },
          data: { status: "FAILED" },
        })
        .catch(() => null),
    );
    invalidateUserBootstrap(userId);
    throw err;
  }
}

/** Return a cached myhora chart or build one with scrape-first semantics. */
export async function ensureNatalChartScrapeFirst(
  userId: string,
  options?: { scrapeTimeoutMs?: number; force?: boolean },
): Promise<ChartJson> {
  const profile = await withPrismaRetry(() =>
    prisma.birthProfile.findUnique({ where: { userId } }),
  );
  if (!profile) {
    throw new AppError("VALIDATION", "Birth profile is required");
  }

  const input = birthProfileToChartInput(profile);
  const existing = await loadReadyChart(userId);
  if (!options?.force && existing && isAcceptableCachedChart(existing, input)) {
    return existing;
  }

  return buildNatalChartScrapeFirst(userId, profile.id, input, options);
}

/**
 * Onboarding / birth-profile edits: always scrape first, then save READY chart.
 */
export async function queueNatalChart(userId: string, birthProfileId: string) {
  const profile = await withPrismaRetry(() =>
    prisma.birthProfile.findUnique({ where: { id: birthProfileId } }),
  );
  if (!profile) return;

  const input = birthProfileToChartInput(profile);
  await buildNatalChartScrapeFirst(userId, birthProfileId, input);
}

/** @deprecated Use ensureNatalChartScrapeFirst — kept for older imports. */
export async function upgradeNatalChartFromScrape(
  userId: string,
  birthProfileId: string,
) {
  const profile = await withPrismaRetry(() =>
    prisma.birthProfile.findUnique({ where: { id: birthProfileId } }),
  );
  if (!profile) return;
  await buildNatalChartScrapeFirst(
    userId,
    birthProfileId,
    birthProfileToChartInput(profile),
  );
}

export async function getNatalChart(userId: string) {
  return withPrismaRetry(() =>
    prisma.natalChart.findUnique({ where: { userId } }),
  );
}

export async function recomputeNatalChart(userId: string) {
  rateLimit(`natal-recompute:${userId}`, 5, 60_000);
  await ensureNatalChartScrapeFirst(userId, { force: true });
  return getNatalChart(userId);
}
