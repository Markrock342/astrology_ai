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
 * Scrape-first natal chart. Falls back to local formula pipeline on failure.
 * Prefer this for production accuracy matching myhora tables.
 */
export async function computeNatalChart(
  input: BirthInputSnapshot,
  options?: { transit?: TransitInput },
): Promise<ChartJson> {
  if (isMyhoraScrapeEnabled()) {
    try {
      const scrape = await fetchMyhoraThaiChart(input, {
        transit: options?.transit,
      });
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
 * When scrape is on, uses myhora with that transit snapshot; else local formula.
 */
export async function computeTransitChart(
  input: BirthInputSnapshot,
  natalInput?: BirthInputSnapshot,
): Promise<ChartJson> {
  const transit: TransitInput = {
    day: input.day,
    month: input.month,
    year: input.year,
    time: input.time,
    preset: "",
  };

  if (isMyhoraScrapeEnabled()) {
    try {
      const birth = natalInput ?? input;
      const scrape = await fetchMyhoraThaiChart(birth, { transit });
      const chart = mapScrapeToChartJson(input, scrape);
      // Prefer transit planet table when present.
      if (scrape.tables.transitPlanets?.length) {
        return {
          ...chart,
          meta: {
            ...chart.meta,
            birthDisplay: formatBirthDisplay(input),
            locationDisplay: formatLocationDisplay(input),
            calculationSource: "myhora-scrape",
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
