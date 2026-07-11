import type { TransitInput } from "@/types/transit";
import type { MyhoraDateDetail } from "@/server/horoscope/engine/myhora/parse-date-detail";

export type { MyhoraDateDetail, MyhoraDateLine, MyhoraDateLineType } from "@/server/horoscope/engine/myhora/parse-date-detail";

/** Structured data scraped from myhora thai.aspx (server-side). */

export interface MyhoraChartEmbeds {
  natalAnalysis?: string | null;
  natalSvg?: string | null;
  rasi: string | null;
  navamsa: string | null;
  drekkana: string | null;
  bhava?: string | null;
}

export interface MyhoraWidgetEmbeds {
  taksa: string | null;
  triwai: string | null;
}

export interface MyhoraNatalPlanet {
  planet: string;
  zodiac: string;
  degree: string;
  minute: string;
  house?: string;
  triyang?: string;
  poison?: string;
  nawamang?: string;
  rerk?: string;
  rerkName?: string;
  baht?: string;
  rerk2?: string;
  rerkBig?: string;
  rerkOwner?: string;
  rerkStandard?: string;
}

export interface MyhoraContentEmbeds {
  chartPlanet: string | null;
  astrologyNatal: string | null;
  astrologyTransit: string | null;
  chartBhava: string | null;
  chartRasiAnalysisNatal: string | null;
  chartRasi10Luck: string | null;
}

export interface MyhoraTaksaCell {
  label: string;
  planetNum: number | null;
  transitLabel: string;
  isCenter?: boolean;
  highlighted?: boolean;
}

export interface MyhoraTriwaiCell {
  house: string;
  planetNum: number;
  ageRange: string;
  highlighted?: boolean;
}

/** Persistable scrape extras attached to ChartJson.myhora */
export interface MyhoraTables {
  lagnaSign: string | null;
  summaryNatal: string | null;
  summaryTransit: string | null;
  dateDetailNatal?: MyhoraDateDetail | null;
  dateDetailTransit?: MyhoraDateDetail | null;
  chartEmbeds?: MyhoraChartEmbeds;
  widgetEmbeds?: MyhoraWidgetEmbeds;
  contentEmbeds?: MyhoraContentEmbeds;
  natalPlanets?: MyhoraNatalPlanet[] | null;
  transitPlanets?: MyhoraNatalPlanet[] | null;
  transit?: TransitInput;
  taksa: (MyhoraTaksaCell | null)[][];
  triwaiNatal: (MyhoraTriwaiCell | null)[][];
  triwaiTransit: (MyhoraTriwaiCell | null)[][];
}
