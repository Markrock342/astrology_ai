import { AppError } from "@/lib/errors";
import { prisma } from "@/server/db";
import type { ChartJson } from "@/types/chart";
import { ensureNatalChartScrapeFirst } from "@/server/horoscope/natal-chart-service";

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
 * Ensure a natal chart for chat/reference — scrape myhora first whenever the
 * cached chart is missing, stale, or still on formula fallback.
 */
export async function requireReadyNatalChart(userId: string): Promise<ChartJson> {
  return assertUsableEngineChart(await ensureNatalChartScrapeFirst(userId));
}
