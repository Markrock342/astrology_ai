import { AppError } from "@/lib/errors";
import { prisma } from "@/server/db";
import type { ChartJson } from "@/types/chart";
import { recomputeNatalChart } from "@/server/horoscope/natal-chart-service";

/** Load READY natal chart JSON for AI context. */
export async function loadChartForUser(userId: string): Promise<ChartJson | null> {
  const row = await prisma.natalChart.findUnique({
    where: { userId },
    select: { status: true, chartJson: true },
  });
  if (!row || row.status !== "READY" || !row.chartJson) return null;
  return row.chartJson as unknown as ChartJson;
}

/**
 * Engine-first gate: ensure a READY natal chart exists before calling Gemini.
 * Recomputes once if missing/pending/failed; throws CHART_NOT_READY if still unavailable.
 */
export async function requireReadyNatalChart(userId: string): Promise<ChartJson> {
  const existing = await loadChartForUser(userId);
  if (existing) return existing;

  const recomputed = await recomputeNatalChart(userId);
  if (recomputed?.status === "READY" && recomputed.chartJson) {
    return recomputed.chartJson as unknown as ChartJson;
  }

  const note =
    recomputed?.note ??
    "ยังคำนวณพื้นดวงไม่สำเร็จ — ตรวจสอบข้อมูลวันเกิดแล้วลองใหม่";
  throw new AppError("CHART_NOT_READY", note);
}
