import { resolvePlaceCoords } from "@/server/horoscope/engine/newhora/data/placeCoordinates";
import type { BirthInputSnapshot, PlanetSignRow } from "@/types/chart";
import type { MyhoraTables } from "@/types/myhora";
import type { TransitInput } from "@/types/transit";
import { defaultTransitInput } from "@/types/transit";
import { parseMyhoraContentPaths } from "./parse-content";
import { parseNatalAnalysisChartPath, parseNatalSvgChartPath } from "./parse-natal-chart";
import {
  isValidMyhoraScrape,
  mergeMyhoraTables,
  parseAscendantOption,
  parseEmbedUrls,
  parsePlanetTable,
  parseViewState,
  planetsFromMyhoraTable,
} from "./parse-html";

const DEFAULT_TIMEOUT_MS = 20_000;
const USER_AGENT = "HoraSard/1.0 (+server-scrape)";

function ceToBe(year: number): number {
  return year + 543;
}

function countryValue(country: string): string {
  const trimmed = country.trim();
  if (trimmed === "ไทย" || trimmed === "ไทย(Thailand)" || !trimmed) return "215";
  return trimmed;
}

export function myhoraOrigin(): string {
  return (process.env.MYHORA_ORIGIN ?? "https://myhora.com").replace(/\/$/, "");
}

/** Scrape enabled unless explicitly set to false/0/off. Default: on. */
export function isMyhoraScrapeEnabled(): boolean {
  const v = process.env.ENABLE_MYHORA_SCRAPE?.trim().toLowerCase();
  if (v === "false" || v === "0" || v === "off" || v === "no") return false;
  return true;
}

export function buildMyhoraFormBody(
  input: BirthInputSnapshot,
  viewState: string,
  generator: string,
  ascValue: string,
  transit: TransitInput = defaultTransitInput(),
): URLSearchParams {
  const [hh, mm] = input.time.split(":");
  const [tHh, tMm] = transit.time.split(":");
  const be = ceToBe(input.year);
  const tBe = ceToBe(transit.year);
  const place = resolvePlaceCoords(input.country, input.province, input.district);
  const utcHours = place.utcOffsetMinutes / 60;
  const utcFormatted =
    utcHours >= 0
      ? `+${String(Math.floor(utcHours)).padStart(2, "0")}:${String(place.utcOffsetMinutes % 60).padStart(2, "0")}`
      : `-${String(Math.floor(-utcHours)).padStart(2, "0")}:${String(Math.abs(place.utcOffsetMinutes % 60)).padStart(2, "0")}`;

  const body = new URLSearchParams({
    __VIEWSTATE: viewState,
    __VIEWSTATEGENERATOR: generator,
    txt_name: "",
    dd_day: String(input.day),
    dd_month: String(input.month),
    dd_year: String(be),
    dd_hh: String(Number(hh) || 0),
    dd_mm: String(Number(mm) || 0),
    dd_province: input.province,
    dd_amphur: input.district,
    dd_country: countryValue(input.country),
    txt_lat_th: String(place.lat),
    txt_lon_th: String(place.lon),
    txt_utc_th: utcFormatted,
    txt_zoom_th: "16",
    dd_day2: String(transit.day),
    dd_month2: String(transit.month),
    dd_year2: String(tBe),
    dd_hh2: String(Number(tHh) || 0),
    dd_mm2: String(Number(tMm) || 0),
    dd_province2: input.province,
    dd_amphur2: input.district,
    setcal: "rb_suriyayas",
    dd_suriyayas_asc: ascValue,
    cb_setday8: "on",
    cb_settaksamid: "on",
    cb_setmnnode: "on",
    cb_setthsnode: "on",
    cb_setaspt: "on",
    btn_submit: "ทำนาย",
  });
  if (transit.preset) {
    body.set("dd_transit_date_option", transit.preset);
  }
  return body;
}

async function fetchText(path: string, init?: RequestInit): Promise<string> {
  const origin = myhoraOrigin();
  const url = path.startsWith("http") ? path : `${origin}${path}`;
  const timeoutMs = Number(process.env.MYHORA_SCRAPE_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) throw new Error(`myhora HTTP ${res.status}`);
    return res.text();
  } finally {
    clearTimeout(timer);
  }
}

export interface MyhoraScrapeResult {
  planets: PlanetSignRow[];
  lagna: string | null;
  tables: MyhoraTables;
}

export interface FetchMyhoraOptions {
  transit?: TransitInput;
}

export async function fetchMyhoraThaiChart(
  input: BirthInputSnapshot,
  options: FetchMyhoraOptions = {},
): Promise<MyhoraScrapeResult> {
  const transit = options.transit ?? defaultTransitInput();

  const landing = await fetchText("/astrology/thai.aspx");
  const vs = parseViewState(landing);
  if (!vs) throw new Error("ไม่พบ __VIEWSTATE จาก myhora");

  const ascValue = parseAscendantOption(landing);
  const body = buildMyhoraFormBody(input, vs.viewState, vs.generator, ascValue, transit);

  const resultHtml = await fetchText("/astrology/thai.aspx", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const { lagnaSign, planets } = parsePlanetTable(resultHtml);
  const embeds = parseEmbedUrls(resultHtml);
  const contentPaths = parseMyhoraContentPaths(resultHtml);

  const [taksaHtml, triwaiHtml, transitHtml, rasiRaw, navamsaRaw, drekkanaRaw, bhavaRaw] =
    await Promise.all([
      embeds.taksa ? fetchText(embeds.taksa) : Promise.resolve(""),
      embeds.triwai ? fetchText(embeds.triwai) : Promise.resolve(""),
      contentPaths.astrologyTransit
        ? fetchText(contentPaths.astrologyTransit)
        : Promise.resolve(""),
      embeds.rasi ? fetchText(embeds.rasi) : Promise.resolve(""),
      embeds.navamsa ? fetchText(embeds.navamsa) : Promise.resolve(""),
      embeds.drekkana ? fetchText(embeds.drekkana) : Promise.resolve(""),
      contentPaths.chartBhava ? fetchText(contentPaths.chartBhava) : Promise.resolve(""),
    ]);

  // Keep raw fetches so we don't drop embed URLs; HTML UI prep is skipped for AI JSON path.
  void rasiRaw;
  void navamsaRaw;
  void drekkanaRaw;
  void bhavaRaw;

  const natalAnalysis =
    parseNatalAnalysisChartPath(resultHtml) ?? contentPaths.chartRasiAnalysisNatal;
  let natalSvg: string | null = null;
  if (natalAnalysis) {
    try {
      const analysisHtml = await fetchText(natalAnalysis);
      natalSvg = parseNatalSvgChartPath(analysisHtml);
    } catch {
      natalSvg = null;
    }
  }

  const tables = mergeMyhoraTables(resultHtml, taksaHtml, triwaiHtml, {
    chartEmbeds: {
      natalAnalysis,
      natalSvg,
      rasi: embeds.rasi,
      navamsa: embeds.navamsa,
      drekkana: embeds.drekkana,
      bhava: contentPaths.chartBhava,
    },
    transit,
    astrologyTransitHtml: transitHtml || null,
  });

  const result: MyhoraScrapeResult = {
    planets: planets.length ? planets : planetsFromMyhoraTable(resultHtml),
    lagna: lagnaSign ?? tables.lagnaSign,
    tables: { ...tables, lagnaSign: lagnaSign ?? tables.lagnaSign },
  };

  if (!isValidMyhoraScrape(result)) {
    throw new Error("myhora scrape incomplete (missing lagna/planets)");
  }

  return result;
}
