import { prisma } from "@/server/db";
import type { BirthInputSnapshot, ChartJson } from "@/types/chart";
import { DISPLAY_TIMEZONE } from "@/config/constants";
import {
  assertUsableEngineChart,
  isUsableEngineChart,
} from "@/server/horoscope/chart-context";
import { computeTransitChart } from "@/server/horoscope/engine/compute-chart";

export type TransitPlaceOverride = {
  country?: string | null;
  province?: string | null;
  district?: string | null;
};

/** YYYY-MM-DD in Asia/Bangkok. */
export function bangkokDateKey(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DISPLAY_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** HH:mm in Asia/Bangkok. */
export function bangkokTimeHm(date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: DISPLAY_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function transitInputForDate(
  date: Date,
  natal: BirthInputSnapshot,
  time?: string | null,
  place?: TransitPlaceOverride | null,
): BirthInputSnapshot {
  // Interpret calendar day in Bangkok for the transit moment noon default.
  const key = bangkokDateKey(date);
  const [y, m, d] = key.split("-").map(Number);
  const country = place?.country?.trim() || natal.country;
  const province = place?.province?.trim() || natal.province;
  const district = place?.district?.trim() || natal.district;
  return {
    day: d,
    month: m,
    year: y,
    time: time?.trim() || "12:00",
    country,
    province,
    district,
  };
}

/**
 * Get today's (or given day's) transit chart from cache, or compute once and store.
 * Chat must not re-scrape myhora every question — short scrape only on cache miss.
 *
 * Conversation TRANSIT mode should pass `skipCache: true` with live Bangkok time
 * and conversation place so predictions stay current.
 */
export async function getOrComputeDailyTransit(
  userId: string,
  natalChart: ChartJson,
  options?: {
    date?: Date;
    time?: string | null;
    place?: TransitPlaceOverride | null;
    /** Skip DailyTransitCache read/write (live TRANSIT threads). */
    skipCache?: boolean;
    scrapeTimeoutMs?: number;
  },
): Promise<ChartJson> {
  const when = options?.date ?? new Date();
  const dateKey = bangkokDateKey(when);

  if (!options?.skipCache) {
    const cached = await prisma.dailyTransitCache.findUnique({
      where: { userId_dateKey: { userId, dateKey } },
    });
    if (cached?.chartJson) {
      const chart = cached.chartJson as unknown as ChartJson;
      if (isUsableEngineChart(chart)) return chart;
    }
  }

  const transitInput = transitInputForDate(
    when,
    natalChart.input,
    options?.time,
    options?.place,
  );
  const chart = assertUsableEngineChart(
    await computeTransitChart(transitInput, natalChart.input, {
      scrapeTimeoutMs: options?.scrapeTimeoutMs ?? 4_000,
    }),
  );

  if (!options?.skipCache) {
    await prisma.dailyTransitCache.upsert({
      where: { userId_dateKey: { userId, dateKey } },
      create: {
        userId,
        dateKey,
        chartJson: chart as object,
        source: chart.meta.calculationSource ?? null,
        computedAt: new Date(),
      },
      update: {
        chartJson: chart as object,
        source: chart.meta.calculationSource ?? null,
        computedAt: new Date(),
      },
    });
  }

  return chart;
}

/** True when the user question likely needs today's transit context. */
export function questionWantsTodayTransit(question: string): boolean {
  return /วันนี้|ตอนนี้|ดวงจร|ประจำวัน|เช้านี้|เย็นนี้|พรุ่งนี้|สัปดาห์นี้/.test(
    question,
  );
}
