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
 */
/** Labels this app no longer writes; their presence means a stale cache. */
const RETIRED_DIGNITY_LABELS = new Set(["สวักษ์"]);

export async function getOrRefreshChartMemory(
  userId: string,
  natalChart: ChartJson,
): Promise<UserChartMemoryJson> {
  const expectedHash = hashBirthInput(natalChart.input);
  const row = await prisma.userChartMemory.findUnique({ where: { userId } });
  const stored = row?.memoryJson as unknown as UserChartMemoryJson | undefined;
  const hasCurrentTaksa =
    Array.isArray(stored?.taksa) &&
    stored.taksa.length === 8 &&
    stored.taksa.every(
      (slot) =>
        typeof slot.planet === "string" && typeof slot.planetNum === "number",
    );
  // Chart memory is cached until the birth input changes, so a correction to
  // the words we write into it would otherwise never reach existing users.
  const hasRetiredWording = [...RETIRED_DIGNITY_LABELS].some((label) =>
    JSON.stringify(stored ?? null).includes(label),
  );
  // Memory is derived from the chart, so it must agree with it. A chart can be
  // recomputed with a different lagna while the birth input — the cache key —
  // stays the same (the fallback that forced 'เมษ' was one such case).
  const natalLagna = natalChart.chart?.lagna ?? natalChart.meta.lagna;
  const agreesWithChart = !natalLagna || stored?.lagna === natalLagna;
  if (
    stored &&
    row?.birthHash === expectedHash &&
    hasCurrentTaksa &&
    !hasRetiredWording &&
    agreesWithChart
  ) {
    return stored;
  }
  return upsertChartMemory(userId, natalChart);
}
