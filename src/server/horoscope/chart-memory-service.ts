import { prisma } from "@/server/db";
import type { ChartJson } from "@/types/chart";
import type { UserChartMemoryJson } from "@/types/chart-memory";
import {
  deriveChartMemory,
  hashBirthInput,
} from "@/server/horoscope/engine/derive-chart-memory";

/** Persist / refresh derived memory for a user from a READY natal chart. */
export async function upsertChartMemory(
  userId: string,
  chart: ChartJson,
): Promise<UserChartMemoryJson> {
  const memory = deriveChartMemory(chart);
  await prisma.userChartMemory.upsert({
    where: { userId },
    create: {
      userId,
      memoryJson: memory as object,
      birthHash: memory.birthHash,
      source: memory.source ?? null,
      computedAt: new Date(memory.computedAt),
    },
    update: {
      memoryJson: memory as object,
      birthHash: memory.birthHash,
      source: memory.source ?? null,
      computedAt: new Date(memory.computedAt),
    },
  });
  return memory;
}

/**
 * Load memory for chat. Re-derives if missing or birth hash no longer matches.
 * Falls back to in-memory derive when the DB client/model is unavailable
 * (e.g. dev server started before `prisma generate`).
 */
export async function getOrRefreshChartMemory(
  userId: string,
  natalChart: ChartJson,
): Promise<UserChartMemoryJson> {
  const expectedHash = hashBirthInput(natalChart.input);
  try {
    const row = await prisma.userChartMemory.findUnique({ where: { userId } });
    if (row?.memoryJson && row.birthHash === expectedHash) {
      return row.memoryJson as unknown as UserChartMemoryJson;
    }
    return await upsertChartMemory(userId, natalChart);
  } catch (err) {
    console.warn(
      "[chart-memory] DB unavailable — deriving in-memory:",
      err instanceof Error ? err.message : err,
    );
    return deriveChartMemory(natalChart);
  }
}
