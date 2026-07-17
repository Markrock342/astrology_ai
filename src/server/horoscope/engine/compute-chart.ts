import type { BirthInputSnapshot, ChartJson } from "@/types/chart";
import type { TransitInput } from "@/types/transit";
import { defaultTransitInput } from "@/types/transit";
import { CALCULATION_SETTINGS } from "./newhora/data/calculationSettings";
import { resolvePlaceCoords } from "./newhora/data/placeCoordinates";
import {
  formatBirthDisplay,
  formatLocationDisplay,
} from "./newhora/dateTimeUtils";
import { computeFullChartSync } from "./newhora/formulas/pipeline";
import {
  fetchMyhoraThaiChart,
  isMyhoraScrapeEnabled,
} from "./myhora/fetch-myhora";
import { mapScrapeToChartJson } from "./myhora/map-to-chart";
import { chartFromMyhoraRows } from "@/lib/chart-derivations";

function toChartJsonFromFormula(input: BirthInputSnapshot): ChartJson {
  const place = resolvePlaceCoords(input.country, input.province, input.district);
  const chart = computeFullChartSync(input, place);

  return {
    input,
    calculatedAt: new Date().toISOString(),
    settings: { ...CALCULATION_SETTINGS },
    meta: {
      birthDisplay: formatBirthDisplay(input),
      locationDisplay: formatLocationDisplay(input),
      calculationSource: chart.source,
      lagna: chart.lagna,
    },
    planets: chart.planets,
    chart: {
      lagna: chart.lagna,
      taksa: chart.taksa,
    },
  };
}

/** Local formula / suryayat path only (sync). */
export function computeNatalChartFormula(input: BirthInputSnapshot): ChartJson {
  return toChartJsonFromFormula(input);
}

/**
 * Scrape-first natal chart with hard timeout, then local formula fallback.
 * Prefer formula for latency-sensitive chat; scrape is best-effort.
 */
export async function computeNatalChart(
  input: BirthInputSnapshot,
  options?: { transit?: TransitInput; scrapeTimeoutMs?: number },
): Promise<ChartJson> {
  if (isMyhoraScrapeEnabled()) {
    const scrapeTimeoutMs = options?.scrapeTimeoutMs ?? 12_000;
    try {
      const scrape = await Promise.race([
        fetchMyhoraThaiChart(input, {
          transit: options?.transit,
          lite: true,
          includeGrids: true,
        }),
        new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error(`myhora scrape timeout after ${scrapeTimeoutMs}ms`)),
            scrapeTimeoutMs,
          );
        }),
      ]);
      return mapScrapeToChartJson(input, scrape);
    } catch (err) {
      console.warn(
        "[myhora] scrape failed, falling back to formula-pipeline:",
        err instanceof Error ? err.message : err,
      );
    }
  }
  return toChartJsonFromFormula(input);
}

/**
 * Transit chart for a moment/place.
 * Short scrape timeout — chat must not hang on myhora.
 */
export async function computeTransitChart(
  input: BirthInputSnapshot,
  natalInput?: BirthInputSnapshot,
  options?: { scrapeTimeoutMs?: number },
): Promise<ChartJson> {
  const transit: TransitInput = {
    day: input.day,
    month: input.month,
    year: input.year,
    time: input.time,
    preset: "",
  };

  if (isMyhoraScrapeEnabled()) {
    const scrapeTimeoutMs = options?.scrapeTimeoutMs ?? 8_000;
    try {
      const birth = natalInput ?? input;
      const scrape = await Promise.race([
        fetchMyhoraThaiChart(birth, { transit, lite: true }),
        new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error(`myhora transit scrape timeout after ${scrapeTimeoutMs}ms`)),
            scrapeTimeoutMs,
          );
        }),
      ]);
      const chart = mapScrapeToChartJson(input, scrape);
      // Prefer transit planet table when present.
      if (scrape.tables.transitPlanets?.length) {
        const transitRows = chartFromMyhoraRows(
          scrape.tables.transitPlanets,
          {
            lagna: chart.chart?.lagna ?? chart.meta.lagna ?? "เมษ",
            planets: chart.planets,
          },
        );
        return {
          ...chart,
          planets: transitRows?.planets ?? chart.planets,
          chart: chart.chart
            ? {
                ...chart.chart,
                lagna: transitRows?.lagna ?? chart.chart.lagna,
              }
            : chart.chart,
          meta: {
            ...chart.meta,
            birthDisplay: formatBirthDisplay(input),
            locationDisplay: formatLocationDisplay(input),
            calculationSource: "myhora-scrape",
            lagna: transitRows?.lagna ?? chart.meta.lagna,
          },
        };
      }
      return chart;
    } catch (err) {
      console.warn(
        "[myhora] transit scrape failed, falling back to formula-pipeline:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  return toChartJsonFromFormula(input);
}

/** @deprecated use computeNatalChartFormula — kept for sync call sites in tests */
export function computeNatalChartSync(input: BirthInputSnapshot): ChartJson {
  return toChartJsonFromFormula(input);
}

export { defaultTransitInput };
