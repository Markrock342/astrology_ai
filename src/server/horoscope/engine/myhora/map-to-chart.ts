import type { BirthInputSnapshot, ChartJson, PlanetSignRow } from "@/types/chart";
import type { MyhoraNatalPlanet, MyhoraTables } from "@/types/myhora";
import { CALCULATION_SETTINGS } from "@/server/horoscope/engine/newhora/data/calculationSettings";
import {
  formatBirthDisplay,
  formatLocationDisplay,
} from "@/server/horoscope/engine/newhora/dateTimeUtils";
import { computeTaksaFromLagna } from "@/server/horoscope/engine/newhora/formulas/taksa";
import { chartFromMyhoraRows } from "@/lib/chart-derivations";
import { myhoraAbbrToSign } from "./sign-codes";
import type { MyhoraScrapeResult } from "./fetch-myhora";

function degreeTextFromSamrap(row: MyhoraNatalPlanet): string | undefined {
  const d = row.degree?.trim();
  const m = row.minute?.trim();
  if (!d && !m) return undefined;
  if (d && m) return `${d}°${m}'`;
  if (d) return `${d}°`;
  return undefined;
}

function enrichPlanetsFromSamrap(
  planets: PlanetSignRow[],
  natalPlanets: MyhoraNatalPlanet[] | null | undefined,
): PlanetSignRow[] {
  if (!natalPlanets?.length) return planets;
  return planets.map((p) => {
    const row = natalPlanets.find(
      (n) => n.planet.includes(p.planet) || p.planet.includes(n.planet.replace(/^[๐-๙0-9.\s]+/, "")),
    );
    if (!row) return p;
    const sign =
      row.zodiac && row.zodiac.length <= 3
        ? myhoraAbbrToSign(row.zodiac)
        : row.zodiac || p.siderealSign;
    return {
      ...p,
      siderealSign: sign || p.siderealSign,
      degreeText: degreeTextFromSamrap(row) ?? p.degreeText,
    };
  });
}

/** Strip heavy/unused fields before storing in NatalChart.chartJson. */
export function slimMyhoraTables(tables: MyhoraTables): MyhoraTables {
  return {
    lagnaSign: tables.lagnaSign,
    summaryNatal: tables.summaryNatal,
    summaryTransit: tables.summaryTransit,
    dateDetailNatal: tables.dateDetailNatal,
    dateDetailTransit: tables.dateDetailTransit,
    natalPlanets: tables.natalPlanets,
    transitPlanets: tables.transitPlanets,
    transit: tables.transit,
    taksa: tables.taksa,
    triwaiNatal: tables.triwaiNatal,
    triwaiTransit: tables.triwaiTransit,
    widgetEmbeds: tables.widgetEmbeds,
    contentEmbeds: tables.contentEmbeds,
    chartEmbeds: tables.chartEmbeds
      ? {
          natalAnalysis: tables.chartEmbeds.natalAnalysis ?? null,
          natalSvg: tables.chartEmbeds.natalSvg ?? null,
          rasi: tables.chartEmbeds.rasi,
          navamsa: tables.chartEmbeds.navamsa,
          drekkana: tables.chartEmbeds.drekkana,
          bhava: tables.chartEmbeds.bhava ?? null,
        }
      : undefined,
  };
}

export function mapScrapeToChartJson(
  input: BirthInputSnapshot,
  scrape: MyhoraScrapeResult,
): ChartJson {
  const lagna = scrape.lagna ?? scrape.tables.lagnaSign ?? "—";
  const enriched = enrichPlanetsFromSamrap(
    scrape.planets,
    scrape.tables.natalPlanets,
  );
  const planets =
    chartFromMyhoraRows(scrape.tables.natalPlanets, {
      lagna,
      planets: enriched,
    })?.planets ?? enriched;
  const taksa = computeTaksaFromLagna(lagna);

  return {
    input,
    calculatedAt: new Date().toISOString(),
    settings: { ...CALCULATION_SETTINGS },
    meta: {
      birthDisplay: formatBirthDisplay(input),
      locationDisplay: formatLocationDisplay(input),
      calculationSource: "myhora-scrape",
      lagna,
    },
    planets,
    chart: {
      lagna,
      taksa,
    },
    myhora: slimMyhoraTables(scrape.tables),
  };
}
