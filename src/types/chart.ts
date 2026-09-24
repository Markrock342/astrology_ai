/**
 * Natal chart JSON stored in `NatalChart.chartJson`.
 * Shape matches newhora `AstrologyResult` (see docs/newhora-integration.md).
 */

export type BirthInputSnapshot = {
  day: number;
  month: number;
  year: number;
  time: string;
  country: string;
  province: string;
  district: string;
};

export type CalculationSettings = {
  calendar: "suryayat";
  ayanamsa: "lahiri";
  timeMethod: "antonathi_samrap_sunrise_local";
  rahuRule: "eight_signs_aquarius";
  taksaRahuLord: "mercury_night";
  /** `center` is retained only to read pre-fix cached JSON. */
  taksaCountFrom: "center" | "birth-weekday";
};

export type PlanetSignRow = {
  planet: string;
  siderealSign: string;
  degreeInSign?: number;
  degreeText?: string;
};

export type TaksaSlot = {
  taksa: string;
  planet: string;
  planetNum: number;
  index: number;
  /** Legacy pre-2026-08-24 cache field; never used for new calculations. */
  sign?: string;
};

export type ChartSnapshot = {
  lagna: string;
  /** Degrees inside the lagna rasi, when known. */
  lagnaDegreeInSign?: number;
  taksa: TaksaSlot[];
};

export type CalculationSource =
  | "myhora-scrape"
  | "suryayat-100-reference"
  | "suryayat-100-year"
  | "suryayat-cached"
  | "formula-pipeline"
  | "ephemeris-fallback";

export type ChartJson = {
  input: BirthInputSnapshot;
  calculatedAt: string;
  settings: CalculationSettings;
  meta: {
    birthDisplay: string;
    locationDisplay: string;
    /** Rebuild cached charts when evidence/derivation rules change. */
    /** Bump CHART_EVIDENCE_VERSION when stored charts must be recomputed. */
    evidenceVersion?: number;
    calculationSource?: CalculationSource;
    lagna?: string;
  };
  planets: PlanetSignRow[];
  chart?: ChartSnapshot;
  /** Structured myhora scrape tables (evidence for UI + AI). */
  myhora?: import("@/types/myhora").MyhoraTables;
};

/**
 * Stored natal charts are recomputed when their evidenceVersion is older.
 * 3: every district now resolves to its own coordinates (v2 used the
 *    province centre, which could shift the lagna by a sign).
 * 4: myhora is sent its numeric province/district ids — names left its
 *    dropdowns on Bangkok, so v3 charts were still computed for กรุงเทพฯ.
 * 5: the local fallback gave every birth on a day the 100-year table has no
 *    lagna for an Aries ascendant ('เมษ' hard-coded), whatever the time. Any
 *    chart built while the myhora scrape was down could carry it.
 */
export const CHART_EVIDENCE_VERSION = 5;
