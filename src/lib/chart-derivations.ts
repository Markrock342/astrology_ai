import type { ChartJson, PlanetSignRow } from "@/types/chart";
import type { MyhoraNatalPlanet } from "@/types/myhora";
import { normalizeSignName, SIGNS } from "@/lib/chart-theme";

export type DerivedChart = {
  lagna: string;
  planets: PlanetSignRow[];
};

export type DivisionalChartKind = "navamsa" | "drekkana";

const SIGN_ABBR: Record<string, string> = {
  มษ: "เมษ",
  พษ: "พฤษภ",
  พภ: "พฤษภ",
  มถ: "มิถุน",
  กฎ: "กรกฎ",
  สห: "สิงห์",
  กย: "กันย์",
  กน: "กันย์",
  ตล: "ตุลย์",
  พจ: "พิจิก",
  ธน: "ธนู",
  มก: "มกร",
  กภ: "กุมภ",
  มี: "มีน",
  มน: "มีน",
};

const PLANET_ORDER = [
  "อาทิตย์",
  "จันทร์",
  "อังคาร",
  "พุธ",
  "พฤหัสบดี",
  "ศุกร์",
  "เสาร์",
  "ราหู",
  "เกตุ",
  "มฤตยู",
];

function parseNumber(raw: string | undefined): number | undefined {
  if (!raw?.trim()) return undefined;
  const ascii = raw.replace(/[๐-๙]/g, (digit) =>
    String("๐๑๒๓๔๕๖๗๘๙".indexOf(digit)),
  );
  const value = Number.parseFloat(ascii.replace(/[^\d.-]/g, ""));
  return Number.isFinite(value) ? value : undefined;
}

function normalizeMyhoraSign(raw: string): string {
  const normalized = normalizeSignName(raw.trim());
  if ((SIGNS as readonly string[]).includes(normalized)) return normalized;
  const abbreviation = raw.split(":").at(-1)?.trim() ?? raw.trim();
  return SIGN_ABBR[abbreviation] ?? abbreviation;
}

function normalizePlanet(raw: string): string {
  const direct = PLANET_ORDER.find((planet) => raw.includes(planet));
  return direct ?? raw.replace(/^[๐-๙0-9.\s]+/, "").trim();
}

function degreeFromRow(row: MyhoraNatalPlanet): number | undefined {
  const degree = parseNumber(row.degree);
  if (degree == null) return undefined;
  const minute = parseNumber(row.minute) ?? 0;
  return Math.min(29.9999, Math.max(0, degree + minute / 60));
}

/** Convert a MyHora samrap table into the same small shape used by our SVGs. */
export function chartFromMyhoraRows(
  rows: MyhoraNatalPlanet[] | null | undefined,
  fallback?: DerivedChart,
): DerivedChart | null {
  if (!rows?.length) return fallback ?? null;
  const lagnaRow = rows.find((row) => row.planet.includes("ลัคนา"));
  const lagna = lagnaRow
    ? normalizeMyhoraSign(lagnaRow.zodiac)
    : fallback?.lagna;
  if (!lagna) return fallback ?? null;

  const parsed = rows
    .filter((row) => !row.planet.includes("ลัคนา"))
    .map((row): PlanetSignRow => {
      const degreeInSign = degreeFromRow(row);
      return {
        planet: normalizePlanet(row.planet),
        siderealSign: normalizeMyhoraSign(row.zodiac),
        degreeInSign,
        degreeText:
          row.degree || row.minute
            ? `${row.degree || "0"}°${row.minute || "0"}′`
            : undefined,
      };
    })
    .filter(
      (row) =>
        PLANET_ORDER.includes(row.planet) &&
        (SIGNS as readonly string[]).includes(row.siderealSign),
    )
    .sort(
      (a, b) =>
        PLANET_ORDER.indexOf(a.planet) - PLANET_ORDER.indexOf(b.planet),
    );
  const parsedByPlanet = new Map(parsed.map((planet) => [planet.planet, planet]));
  const merged = fallback?.planets.length
    ? fallback.planets.map(
        (planet) => parsedByPlanet.get(planet.planet) ?? planet,
      )
    : parsed;

  return {
    lagna,
    planets: merged.length > 0 ? merged : (fallback?.planets ?? []),
  };
}

function signIndex(sign: string): number {
  const index = SIGNS.indexOf(
    normalizeMyhoraSign(sign) as (typeof SIGNS)[number],
  );
  return index >= 0 ? index : 0;
}

function offsetSign(baseSign: string, offset: number): string {
  return SIGNS[(signIndex(baseSign) + offset + 12) % 12] ?? SIGNS[0];
}

export function computeNavamsaSign(
  sign: string,
  degreeInSign: number,
): string {
  const normalized = normalizeMyhoraSign(sign);
  const index = signIndex(normalized);
  const segment = Math.min(8, Math.floor(degreeInSign / (30 / 9)));
  // Classical D9: movable starts from itself, fixed from the ninth, dual from
  // the fifth. This matches the engine's Parashari implementation.
  const startOffset = [0, 3, 6, 9].includes(index)
    ? 0
    : [1, 4, 7, 10].includes(index)
      ? 8
      : 4;
  return offsetSign(normalized, startOffset + segment);
}

export function computeDrekkanaSign(
  sign: string,
  degreeInSign: number,
): string {
  const normalized = normalizeMyhoraSign(sign);
  const index = signIndex(normalized);
  const segment = Math.min(2, Math.floor(degreeInSign / 10));
  const movable = [0, 3, 6, 9].includes(index);
  const fixed = [1, 4, 7, 10].includes(index);
  const start = movable
    ? normalized
    : fixed
      ? offsetSign(normalized, 8)
      : offsetSign(normalized, 4);
  const sequence = movable
    ? [0, 4, 8]
    : fixed
      ? [8, 4, 0]
      : [4, 8, 0];
  return offsetSign(start, sequence[segment] ?? 0);
}

/** Build D9/D3 directly from MyHora degrees, with stored engine degrees as fallback. */
export function deriveDivisionalChart(
  chart: ChartJson,
  kind: DivisionalChartKind,
): DerivedChart {
  const base: DerivedChart = {
    lagna: chart.chart?.lagna ?? chart.meta.lagna ?? "เมษ",
    planets: chart.planets,
  };
  const myhora = chartFromMyhoraRows(chart.myhora?.natalPlanets, base) ?? base;
  const lagnaRow = chart.myhora?.natalPlanets?.find((row) =>
    row.planet.includes("ลัคนา"),
  );
  const lagnaDegree = lagnaRow ? degreeFromRow(lagnaRow) : undefined;
  const mapSign =
    kind === "navamsa" ? computeNavamsaSign : computeDrekkanaSign;

  return {
    lagna: mapSign(myhora.lagna, lagnaDegree ?? 15),
    planets: myhora.planets.map((planet) => ({
      ...planet,
      siderealSign: mapSign(
        planet.siderealSign,
        planet.degreeInSign ?? 15,
      ),
    })),
  };
}
