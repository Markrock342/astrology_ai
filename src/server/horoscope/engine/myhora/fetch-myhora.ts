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
import {
  bangkokDistrictId,
  findDistrictId,
  MYHORA_BANGKOK_PROVINCE_ID,
  MYHORA_PROVINCE_IDS,
  parseAmphurOptions,
  parseDeltaViewState,
  type MyhoraPlaceIds,
} from "./place-ids";

const DEFAULT_TIMEOUT_MS = 8_000;
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
  placeIds: MyhoraPlaceIds = {},
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
    // myhora expects its own numeric ids here; names are a last resort.
    dd_province: placeIds.province ?? input.province,
    dd_amphur: placeIds.amphur ?? input.district,
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
    dd_province2: placeIds.province2 ?? (transit.province?.trim() || input.province),
    dd_amphur2: placeIds.amphur2 ?? (transit.district?.trim() || input.district),
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
  /** Which dropdown ids the form was submitted with (diagnostics). */
  placeIds?: MyhoraPlaceIds;
}

/**
 * Resolve myhora's numeric province/district ids for the birth and transit
 * places. Non-Bangkok districts need a province-change postback, which also
 * yields the view state the final submit must carry. Any failure keeps the
 * previous behaviour (names) for that field rather than aborting the scrape.
 */
async function resolvePlaceIds(
  input: BirthInputSnapshot,
  transit: TransitInput,
  vs: { viewState: string; generator: string },
  ascValue: string,
): Promise<{ ids: MyhoraPlaceIds; viewState: string; generator: string }> {
  const ids: MyhoraPlaceIds = {};
  let viewState = vs.viewState;
  let generator = vs.generator;

  async function postback(
    target: "dd_province" | "dd_province2",
    provinceId: string,
  ): Promise<Record<string, string> | null> {
    const body = buildMyhoraFormBody(input, viewState, generator, ascValue, transit, ids);
    body.set(target, provinceId);
    body.set("scriptManager", `${target === "dd_province" ? "tup_natal" : "tup_transit"}|${target}`);
    body.set("__EVENTTARGET", target);
    body.set("__EVENTARGUMENT", "");
    body.set("__LASTFOCUS", "");
    body.set("__ASYNCPOST", "true");
    body.delete("btn_submit");
    const text = await fetchText("/astrology/thai.aspx", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-MicrosoftAjax": "Delta=true",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: body.toString(),
    });
    const delta = parseDeltaViewState(text);
    if (delta.viewState) viewState = delta.viewState;
    if (delta.generator) generator = delta.generator;
    return parseAmphurOptions(text, target === "dd_province" ? "dd_amphur" : "dd_amphur2");
  }

  const places: Array<{
    target: "dd_province" | "dd_province2";
    province: string;
    district: string;
    set: (province: string, amphur?: string) => void;
  }> = [
    {
      target: "dd_province",
      province: input.province,
      district: input.district,
      set: (province, amphur) => {
        ids.province = province;
        if (amphur) ids.amphur = amphur;
      },
    },
    {
      target: "dd_province2",
      province: transit.province?.trim() || input.province,
      district: transit.district?.trim() || input.district,
      set: (province, amphur) => {
        ids.province2 = province;
        if (amphur) ids.amphur2 = amphur;
      },
    },
  ];

  for (const place of places) {
    const provinceId = MYHORA_PROVINCE_IDS[place.province.trim()];
    if (!provinceId) continue;
    if (provinceId === MYHORA_BANGKOK_PROVINCE_ID) {
      place.set(provinceId, bangkokDistrictId(place.district));
      continue;
    }
    try {
      const options = await postback(place.target, provinceId);
      place.set(provinceId, options ? findDistrictId(options, place.district) : undefined);
    } catch (err) {
      console.warn(
        `[myhora] ${place.target} postback failed — submitting names for ${place.province}/${place.district}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return { ids, viewState, generator };
}

export interface FetchMyhoraOptions {
  transit?: TransitInput;
  /** Skip embed iframes (taksa/triwai/charts) — much faster for AI prompts. */
  lite?: boolean;
  /** In lite mode, still fetch the two compact evidence grids for cached natal UI. */
  includeGrids?: boolean;
  /**
   * In lite mode, also fetch the transit content page. The main results page
   * has no transit table, so without this a "transit" scrape only carries the
   * natal positions.
   */
  includeTransit?: boolean;
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
  const resolved = await resolvePlaceIds(input, transit, vs, ascValue);
  const body = buildMyhoraFormBody(
    input,
    resolved.viewState,
    resolved.generator,
    ascValue,
    transit,
    resolved.ids,
  );

  const resultHtml = await fetchText("/astrology/thai.aspx", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const { lagnaSign, planets } = parsePlanetTable(resultHtml);
  const embeds = parseEmbedUrls(resultHtml);
  const contentPaths = parseMyhoraContentPaths(resultHtml);

  if (options.lite) {
    const [taksaHtml, triwaiHtml, transitHtml] = await Promise.all([
      options.includeGrids && embeds.taksa ? fetchText(embeds.taksa) : Promise.resolve(""),
      options.includeGrids && embeds.triwai ? fetchText(embeds.triwai) : Promise.resolve(""),
      options.includeTransit && contentPaths.astrologyTransit
        ? fetchText(contentPaths.astrologyTransit)
        : Promise.resolve(""),
    ]);
    const tables = mergeMyhoraTables(resultHtml, taksaHtml, triwaiHtml, {
      chartEmbeds: {
        natalAnalysis: null,
        natalSvg: null,
        rasi: null,
        navamsa: null,
        drekkana: null,
      },
      transit,
      astrologyTransitHtml: transitHtml || null,
    });
    const result: MyhoraScrapeResult = {
      planets: planets.length ? planets : planetsFromMyhoraTable(resultHtml),
      lagna: lagnaSign ?? tables.lagnaSign,
      tables: { ...tables, lagnaSign: lagnaSign ?? tables.lagnaSign },
      placeIds: resolved.ids,
    };
    if (!isValidMyhoraScrape(result)) {
      throw new Error("myhora scrape incomplete (missing lagna/planets)");
    }
    return result;
  }

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
    placeIds: resolved.ids,
  };

  if (!isValidMyhoraScrape(result)) {
    throw new Error("myhora scrape incomplete (missing lagna/planets)");
  }

  return result;
}
