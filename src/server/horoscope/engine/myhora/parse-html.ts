import { MYHORA_PLANET_NUM, myhoraAbbrToSign } from "./sign-codes";
import { PLANETS } from "@/server/horoscope/engine/newhora/data/astrologyConstants";
import type { PlanetSignRow } from "@/types/chart";
import type { MyhoraTables, MyhoraTaksaCell, MyhoraTriwaiCell } from "@/types/myhora";
import { parseDateInfoFromMainHtml } from "./parse-date-detail";
import {
  extractNatalTableHtml,
  extractTransitTableHtml,
  parseMyhoraContentPaths,
} from "./parse-content";
import { extractNatalTableData } from "./parse-samrap-data";

function planetNumFromImg(html: string): number | null {
  const m = html.match(/\/star\/A(\d)\.png/i) ?? html.match(/\/star\/a(\d)\.png/i);
  if (!m) return null;
  return Number(m[1]);
}

export function parseViewState(html: string): { viewState: string; generator: string } | null {
  const viewState = html.match(/name="__VIEWSTATE"[^>]*value="([^"]*)"/)?.[1];
  if (!viewState) return null;
  const generator =
    html.match(/name="__VIEWSTATEGENERATOR"[^>]*value="([^"]*)"/)?.[1] ?? "";
  return { viewState, generator };
}

export function parseAscendantOption(html: string): string {
  const block = html.match(/<select name="dd_suriyayas_asc"[\s\S]*?<\/select>/)?.[0] ?? "";
  const antonathi = [...block.matchAll(/<option value="([^"]*)"[^>]*>([^<]*)</g)].find(
    (o) => o[2].includes("สมผุสอาทิตย์อุทัย") && o[2].includes("ปรับเวลาท้องถิ่น"),
  );
  if (antonathi) return antonathi[1];

  const selected =
    block.match(/<option selected="selected" value="([^"]*)"/)?.[1] ??
    block.match(/<option value="([^"]*)" selected="selected"/)?.[1];
  if (selected) return selected;

  return "3";
}

export function parsePlanetTable(html: string): {
  lagnaSign: string | null;
  planets: PlanetSignRow[];
} {
  const planets: PlanetSignRow[] = [];
  let lagnaSign: string | null = null;

  const rowRe =
    /<tr class="tr\d+">[\s\S]*?<td[^>]*>([^<]*)<\/td>[\s\S]*?<td[^>]*>\s*(\d+)\s*:\s*([^<]+)<\/td>/gi;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html)) !== null) {
    const label = m[1].replace(/\s+/g, " ").trim();
    const abbr = m[3].trim();
    const sign = myhoraAbbrToSign(abbr);

    if (label.includes("ลัคนา")) {
      lagnaSign = sign;
      continue;
    }

    const planetMatch = label.match(/[๐-๙]?([๐-๙0-9])\.(.+)/);
    if (!planetMatch) continue;
    const thaiDigit = planetMatch[1];
    const digit = thaiDigit
      .replace(/๐/g, "0")
      .replace(/๑/g, "1")
      .replace(/๒/g, "2")
      .replace(/๓/g, "3")
      .replace(/๔/g, "4")
      .replace(/๕/g, "5")
      .replace(/๖/g, "6")
      .replace(/๗/g, "7")
      .replace(/๘/g, "8")
      .replace(/๙/g, "9");
    const num = Number(digit);
    const planetName = MYHORA_PLANET_NUM[num];
    if (!planetName) continue;
    planets.push({ planet: planetName, siderealSign: sign });
  }

  const ordered = PLANETS.map((planet) => {
    const row = planets.find((p) => p.planet === planet);
    return row ?? { planet, siderealSign: "—" };
  });

  return { lagnaSign, planets: ordered };
}

function loadPath(html: string, chartId: string): string | null {
  return html.match(new RegExp(`#div_chart_${chartId}'\\)\\.load\\("([^"]+)"`))?.[1] ?? null;
}

export function parseEmbedUrls(html: string): {
  taksa: string | null;
  triwai: string | null;
  rasi: string | null;
  navamsa: string | null;
  drekkana: string | null;
} {
  return {
    rasi: loadPath(html, "sign"),
    navamsa: loadPath(html, "navang"),
    drekkana: loadPath(html, "triyang"),
    taksa: loadPath(html, "taksa"),
    triwai: loadPath(html, "triwai"),
  };
}

export function parseSummaryLines(html: string): {
  natal: string | null;
  transit: string | null;
} {
  const { natal: n, transit: t } = parseDateInfoFromMainHtml(html);
  return {
    natal: n?.raw ?? null,
    transit: t?.raw ?? null,
  };
}

function parseTaksaTable(tableHtml: string): (MyhoraTaksaCell | null)[][] {
  const rows: (MyhoraTaksaCell | null)[][] = [];
  const trRe = /<tr>([\s\S]*?)<\/tr>/gi;
  let tr: RegExpExecArray | null;
  while ((tr = trRe.exec(tableHtml)) !== null) {
    const row: (MyhoraTaksaCell | null)[] = [];
    const tdRe = /<td([^>]*)>([\s\S]*?)<\/td>/gi;
    let td: RegExpExecArray | null;
    while ((td = tdRe.exec(tr[1])) !== null) {
      const cell = td[2];
      if (/>&nbsp;</.test(cell) && !cell.includes("cts-nlab")) {
        row.push(null);
        continue;
      }
      const label = cell.match(/class='cts-nlab'>([^<]*)</)?.[1]?.trim() ?? "";
      const transitLabel = cell.match(/class='cts-tlab'>([^<]*)</)?.[1]?.trim() ?? "";
      const planetNum = planetNumFromImg(cell);
      const highlighted =
        /TX2\.png/i.test(cell) || (planetNum === 9 && /opacity:\s*0\.4/i.test(cell));
      const isCenter = planetNum === 9 && !label;

      if (!label && !planetNum && !transitLabel) {
        row.push(null);
        continue;
      }

      row.push({
        label: label || (isCenter ? "กลาง" : ""),
        planetNum,
        transitLabel,
        isCenter,
        highlighted,
      });
    }
    if (row.length) rows.push(row);
  }
  return rows;
}

export function parseTaksaHtml(html: string): (MyhoraTaksaCell | null)[][] {
  const visible =
    html.match(
      /id="cb_taksa_mid_count29"[^>]*style="display:block;">([\s\S]*?)<\/div>\s*<\/div>/i,
    )?.[1] ??
    html.match(
      /id="cb_taksa_mid_count28"[^>]*style="display:block;">([\s\S]*?)<\/div>\s*<\/div>/i,
    )?.[1];
  const table =
    visible?.match(/<table[\s\S]*?<\/table>/i)?.[0] ??
    html.match(/<table[\s\S]*?<\/table>/i)?.[0];
  if (!table) return [];
  return parseTaksaTable(table);
}

function parseTriwaiTable(tableHtml: string): (MyhoraTriwaiCell | null)[][] {
  const rows: (MyhoraTriwaiCell | null)[][] = [];
  const trRe = /<tr>([\s\S]*?)<\/tr>/gi;
  let tr: RegExpExecArray | null;
  while ((tr = trRe.exec(tableHtml)) !== null) {
    const row: (MyhoraTriwaiCell | null)[] = [];
    const tdRe = /<td([^>]*)>([\s\S]*?)<\/td>/gi;
    let td: RegExpExecArray | null;
    while ((td = tdRe.exec(tr[1])) !== null) {
      const cell = td[2];
      const house = cell.match(/class="ctw-houx">([^<]*)</)?.[1]?.trim();
      const ageRange = cell.match(/class="ctw-age">([^<]*)</)?.[1]?.trim();
      const planetNum = planetNumFromImg(cell);
      if (!house || !ageRange || planetNum == null) {
        row.push(null);
        continue;
      }
      row.push({
        house,
        planetNum,
        ageRange,
        highlighted: /triwai\/TWT\.png/i.test(cell),
      });
    }
    if (row.length) rows.push(row);
  }
  return rows;
}

export function parseTriwaiHtml(html: string): {
  natal: (MyhoraTriwaiCell | null)[][];
  transit: (MyhoraTriwaiCell | null)[][];
} {
  const tables = [
    ...html.matchAll(
      /<table border="0" align="center" cellpadding="0" cellspacing="0" style="font-size:0\.95em;">([\s\S]*?)<\/table>/gi,
    ),
  ];
  const parsed = tables.map((t) => parseTriwaiTable(t[0]));
  return {
    natal: parsed[0] ?? [],
    transit: parsed[1] ?? [],
  };
}

export function mergeMyhoraTables(
  mainHtml: string,
  taksaHtml: string,
  triwaiHtml: string,
  extra?: Pick<MyhoraTables, "chartEmbeds" | "transit"> & {
    astrologyTransitHtml?: string | null;
  },
): MyhoraTables {
  const { lagnaSign } = parsePlanetTable(mainHtml);
  const summaries = parseSummaryLines(mainHtml);
  const dateDetails = parseDateInfoFromMainHtml(mainHtml);
  const taksa = parseTaksaHtml(taksaHtml);
  const triwai = parseTriwaiHtml(triwaiHtml);
  const embeds = parseEmbedUrls(mainHtml);
  const contentPaths = parseMyhoraContentPaths(mainHtml);
  const natalTableRaw = extractNatalTableHtml(mainHtml);
  const transitTableSource = extra?.astrologyTransitHtml ?? mainHtml;
  const transitTableRaw = extractTransitTableHtml(transitTableSource);

  return {
    lagnaSign: lagnaSign ?? null,
    summaryNatal: summaries.natal,
    summaryTransit: summaries.transit,
    dateDetailNatal: dateDetails.natal,
    dateDetailTransit: dateDetails.transit,
    chartEmbeds: extra?.chartEmbeds ?? {
      natalAnalysis: null,
      natalSvg: null,
      rasi: embeds.rasi,
      navamsa: embeds.navamsa,
      drekkana: embeds.drekkana,
    },
    widgetEmbeds: {
      taksa: embeds.taksa,
      triwai: embeds.triwai,
    },
    contentEmbeds: contentPaths,
    natalPlanets: extractNatalTableData(natalTableRaw),
    transitPlanets: extractNatalTableData(transitTableRaw),
    transit: extra?.transit ?? {
      day: new Date().getDate(),
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      time: "12:00",
    },
    taksa,
    triwaiNatal: triwai.natal,
    triwaiTransit: triwai.transit,
  };
}

export function planetsFromMyhoraTable(mainHtml: string): PlanetSignRow[] {
  return parsePlanetTable(mainHtml).planets;
}

/** Gate: scrape is usable for AI / storage. */
export function isValidMyhoraScrape(result: {
  lagna: string | null;
  planets: PlanetSignRow[];
}): boolean {
  if (!result.lagna || result.lagna === "—") return false;
  const real = result.planets.filter((p) => p.siderealSign && p.siderealSign !== "—");
  return real.length >= 7;
}
