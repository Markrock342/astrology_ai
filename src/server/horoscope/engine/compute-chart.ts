import { CHART_EVIDENCE_VERSION, type BirthInputSnapshot, type ChartJson } from "@/types/chart";
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
      evidenceVersion: CHART_EVIDENCE_VERSION,
      calculationSource: chart.source,
      lagna: chart.lagna,
    },
    planets: chart.planets,
    chart: {
      lagna: chart.lagna,
      lagnaDegreeInSign: chart.lagnaDegreeInSign,
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
function withNatalLagna(chart: ChartJson, natalLagna: string | undefined): ChartJson {
  if (!natalLagna) return chart;
  return {
    ...chart,
    chart: chart.chart ? { ...chart.chart, lagna: natalLagna } : chart.chart,
    meta: { ...chart.meta, lagna: natalLagna },
  };
}

/**
 * Transit chart for a moment/place. The ascendant stays the NATAL lagna: Thai
 * transit reading (ดาวจร) places the day's planets into the birth chart's
 * houses, so the wheel, the evidence table and the AI all count houses from
 * the same ล. The transit-moment ascendant is not what the reader wants.
 */
export async function computeTransitChart(
  input: BirthInputSnapshot,
  natalInput?: BirthInputSnapshot,
  options?: { scrapeTimeoutMs?: number; natalLagna?: string },
): Promise<ChartJson> {
  const transit: TransitInput = {
    day: input.day,
    month: input.month,
    year: input.year,
    time: input.time,
    preset: "",
    province: input.province,
    district: input.district,
  };

  if (isMyhoraScrapeEnabled()) {
    const scrapeTimeoutMs = options?.scrapeTimeoutMs ?? 8_000;
    try {
      const birth = natalInput ?? input;
      const scrape = await Promise.race([
        fetchMyhoraThaiChart(birth, { transit, lite: true, includeTransit: true }),
        new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error(`myhora transit scrape timeout after ${scrapeTimeoutMs}ms`)),
            scrapeTimeoutMs,
          );
        }),
      ]);
      // The scrape is keyed on the BIRTH data, so its planet table is the natal
      // chart. Only the transit table describes the day being asked about — if
      // it is missing, returning `chart` would hand the natal positions to the
      // wheel and to the AI as "ดาวจร" (every future date read the same).
      if (!scrape.tables.transitPlanets?.length) {
        console.warn(
          "[myhora] transit scrape returned no transit table — using formula-pipeline for the transit day",
        );
        return withNatalLagna(toChartJsonFromFormula(input), options?.natalLagna);
      }
      // mapScrapeToChartJson is keyed on the birth data, so its lagna is the
      // natal lagna — exactly the one the transit chart must keep.
      const chart = mapScrapeToChartJson(input, scrape);
      {
        const natalLagna =
          options?.natalLagna ?? chart.chart?.lagna ?? chart.meta.lagna ?? "เมษ";
        const transitRows = chartFromMyhoraRows(
          scrape.tables.transitPlanets,
          { lagna: natalLagna, planets: chart.planets },
        );
        return withNatalLagna(
          {
            ...chart,
            planets: transitRows?.planets ?? chart.planets,
            meta: {
              ...chart.meta,
              birthDisplay: formatBirthDisplay(input),
              locationDisplay: formatLocationDisplay(input),
              calculationSource: "myhora-scrape",
            },
          },
          natalLagna,
        );
      }
    } catch (err) {
      console.warn(
        "[myhora] transit scrape failed, falling back to formula-pipeline:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  return withNatalLagna(toChartJsonFromFormula(input), options?.natalLagna);
}

/** @deprecated use computeNatalChartFormula — kept for sync call sites in tests */
export function computeNatalChartSync(input: BirthInputSnapshot): ChartJson {
  return toChartJsonFromFormula(input);
}

export { defaultTransitInput };
