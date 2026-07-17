import { AppError } from "@/lib/errors";
import { prisma } from "@/server/db";
import type { ChartJson } from "@/types/chart";
import {
  birthProfileToChartInput,
  chartInputMatches,
} from "@/server/horoscope/engine/birth-input-mapper";
import { computeNatalChartFormula } from "@/server/horoscope/engine/compute-chart";
import { upgradeNatalChartFromScrape } from "@/server/horoscope/natal-chart-service";
import { upsertChartMemory } from "@/server/horoscope/chart-memory-service";

/** Chart is usable as AI evidence only if lagna + planet rows exist. */
export function isUsableEngineChart(
  chart: ChartJson | null | undefined,
): chart is ChartJson {
  if (!chart) return false;
  const lagna = chart.chart?.lagna ?? chart.meta?.lagna;
  return Boolean(lagna && Array.isArray(chart.planets) && chart.planets.length >= 7);
}

export function assertUsableEngineChart(chart: ChartJson | null | undefined): ChartJson {
  if (!isUsableEngineChart(chart)) {
    throw new AppError(
      "CHART_NOT_READY",
      "ยังไม่มีพื้นดวงจาก engine — กรุณาบันทึกวันเกิดใหม่แล้วลองอีกครั้ง",
    );
  }
  return chart;
}

/** Load READY natal chart JSON for AI context. */
export async function loadChartForUser(userId: string): Promise<ChartJson | null> {
  const row = await prisma.natalChart.findUnique({
    where: { userId },
    select: { status: true, chartJson: true },
  });
  if (!row || row.status !== "READY" || !row.chartJson) return null;
  const chart = row.chartJson as unknown as ChartJson;
  return isUsableEngineChart(chart) ? chart : null;
}

/**
 * Ensure a natal chart for chat — never blocks on myhora scrape.
 * Uses cached READY chart, else local formula immediately, then upgrades scrape in background.
 * Always returns a chart with lagna + planets so every prompt can cite the engine.
 */
export async function requireReadyNatalChart(userId: string): Promise<ChartJson> {
  const [existing, profile] = await Promise.all([
    loadChartForUser(userId),
    prisma.birthProfile.findUnique({ where: { userId } }),
  ]);
  if (!profile) {
    throw new AppError("VALIDATION", "Birth profile is required");
  }

  const input = birthProfileToChartInput(profile);
  // Charts created before the timezone fix used UTC calendar fields. For Thai
  // births before 07:00 that shifted the input to the previous civil date.
  // Repair stale cached charts automatically on the next chat request.
  if (existing && chartInputMatches(existing.input, input)) return existing;

  const formula = computeNatalChartFormula(input);
  assertUsableEngineChart(formula);

  await prisma.natalChart.upsert({
    where: { userId },
    create: {
      userId,
      birthProfileId: profile.id,
      status: "READY",
      chartJson: formula as object,
      note: formula.meta.calculationSource ?? "formula-pipeline",
      computedAt: new Date(),
    },
    update: {
      birthProfileId: profile.id,
      status: "READY",
      chartJson: formula as object,
      note: formula.meta.calculationSource ?? "formula-pipeline",
      computedAt: new Date(),
    },
  });

  void upsertChartMemory(userId, formula).catch((err) => {
    console.warn(
      "[natal] chart memory upsert failed:",
      err instanceof Error ? err.message : err,
    );
  });

  // Best-effort myhora upgrade — must not delay Gemini.
  void upgradeNatalChartFromScrape(userId, profile.id).catch((err) => {
    console.warn(
      "[natal] background scrape upgrade failed:",
      err instanceof Error ? err.message : err,
    );
  });

  return formula;
}
