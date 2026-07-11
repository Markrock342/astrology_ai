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
  taksaCountFrom: "center";
};

export type PlanetSignRow = {
  planet: string;
  siderealSign: string;
  degreeInSign?: number;
  degreeText?: string;
};

export type TaksaSlot = {
  taksa: string;
  sign: string;
  index: number;
};

export type ChartSnapshot = {
  lagna: string;
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
    calculationSource?: CalculationSource;
    lagna?: string;
  };
  planets: PlanetSignRow[];
  chart?: ChartSnapshot;
};
