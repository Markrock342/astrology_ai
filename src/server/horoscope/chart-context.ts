import { prisma } from "@/server/db";
import type { ChartJson } from "@/types/chart";

/** Load READY natal chart JSON for AI context. */
export async function loadChartForUser(userId: string): Promise<ChartJson | null> {
  const row = await prisma.natalChart.findUnique({
    where: { userId },
    select: { status: true, chartJson: true },
  });
  if (!row || row.status !== "READY" || !row.chartJson) return null;
  return row.chartJson as ChartJson;
}
