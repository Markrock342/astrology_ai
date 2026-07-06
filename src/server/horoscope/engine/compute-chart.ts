import type { BirthInputSnapshot, ChartJson } from "@/types/chart";
import { CALCULATION_SETTINGS } from "./newhora/data/calculationSettings";
import { resolvePlaceCoords } from "./newhora/data/placeCoordinates";
import {
  formatBirthDisplay,
  formatLocationDisplay,
} from "./newhora/dateTimeUtils";
import { computeFullChartSync } from "./newhora/formulas/pipeline";

/** Compute natal chart via vendored newhora formula pipeline (astronomy-engine). */
export function computeNatalChart(input: BirthInputSnapshot): ChartJson {
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
