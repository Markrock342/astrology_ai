import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  isValidMyhoraScrape,
  mergeMyhoraTables,
  parsePlanetTable,
  parseViewState,
} from "@/server/horoscope/engine/myhora/parse-html";
import { extractNatalTableData } from "@/server/horoscope/engine/myhora/parse-samrap-data";
import { mapScrapeToChartJson } from "@/server/horoscope/engine/myhora/map-to-chart";
import { formatChartForPrompt } from "@/server/horoscope/engine/format-chart-prompt";
import {
  computeNatalChart,
  computeNatalChartFormula,
} from "@/server/horoscope/engine/compute-chart";

const SAMPLE_INPUT = {
  day: 21,
  month: 5,
  year: 2006,
  time: "18:31",
  country: "ไทย",
  province: "กรุงเทพมหานคร",
  district: "พระนคร",
} as const;

const FIXTURE_MAIN = `
<input type="hidden" name="__VIEWSTATE" value="abcVIEW" />
<input type="hidden" name="__VIEWSTATEGENERATOR" value="gen1" />
<table>
<tr class="tr1"><td>ล.ลัคนา</td><td>09 : สห</td></tr>
<tr class="tr2"><td>๑.อาทิตย์</td><td>03 : มถ</td></tr>
<tr class="tr3"><td>๒.จันทร์</td><td>05 : กน</td></tr>
<tr class="tr4"><td>๓.อังคาร</td><td>01 : มษ</td></tr>
<tr class="tr5"><td>๔.พุธ</td><td>11 : กภ</td></tr>
<tr class="tr6"><td>๕.พฤหัสบดี</td><td>07 : ตล</td></tr>
<tr class="tr7"><td>๖.ศุกร์</td><td>02 : พษ</td></tr>
<tr class="tr8"><td>๗.เสาร์</td><td>10 : มก</td></tr>
<tr class="tr9"><td>๘.ราหู</td><td>12 : มี</td></tr>
<tr class="tr10"><td>๙.เกตุ</td><td>06 : กฎ</td></tr>
<tr class="tr11"><td>๐.มฤตยู</td><td>04 : สห</td></tr>
</table>
<div id="natal-table">
<table>
<tr class="tr1"><td>ล.ลัคนา</td><td>สิงห์</td><td>10</td><td>20</td></tr>
<tr class="trx1"><td>1</td><td>—</td><td>—</td><td>1</td><td></td><td>1</td><td>อัสวินี</td><td>1</td><td>1</td><td>1</td><td>อังคาร</td><td>ปกติ</td></tr>
<tr class="tr2"><td>๑.อาทิตย์</td><td>มิถุน</td><td>5</td><td>10</td></tr>
<tr class="trx2"><td>11</td><td>—</td><td>—</td><td>3</td><td></td><td>2</td><td>ภรณี</td><td>1</td><td>1</td><td>1</td><td>ศุกร์</td><td>ปกติ</td></tr>
</table>
</div>
<div id="astrology_natal"></div>
`;

describe("myhora HTML parsers", () => {
  it("parses viewstate", () => {
    const vs = parseViewState(FIXTURE_MAIN);
    expect(vs?.viewState).toBe("abcVIEW");
    expect(vs?.generator).toBe("gen1");
  });

  it("parses planet table with Thai signs", () => {
    const { lagnaSign, planets } = parsePlanetTable(FIXTURE_MAIN);
    expect(lagnaSign).toBe("สิงห์");
    expect(planets.find((p) => p.planet === "อาทิตย์")?.siderealSign).toBe("มิถุน");
    expect(planets.find((p) => p.planet === "จันทร์")?.siderealSign).toBe("กันย์");
    expect(isValidMyhoraScrape({ lagna: lagnaSign, planets })).toBe(true);
  });

  it("extracts samrap natal rows", () => {
    const tables = mergeMyhoraTables(FIXTURE_MAIN, "", "");
    expect(tables.natalPlanets?.length).toBeGreaterThanOrEqual(2);
    expect(tables.natalPlanets?.[0]?.planet).toMatch(/ลัคนา/);
  });

  it("maps scrape into ChartJson with myhora evidence", () => {
    const { lagnaSign, planets } = parsePlanetTable(FIXTURE_MAIN);
    const tables = mergeMyhoraTables(FIXTURE_MAIN, "", "");
    const chart = mapScrapeToChartJson(
      { ...SAMPLE_INPUT },
      { planets, lagna: lagnaSign, tables },
    );
    expect(chart.meta.calculationSource).toBe("myhora-scrape");
    expect(chart.myhora?.natalPlanets?.length).toBeGreaterThan(0);
    const text = formatChartForPrompt(chart);
    expect(text).toContain("ตารางสมผุส");
    expect(text).toContain("myhora");
  });

  it("extractNatalTableData returns null on garbage", () => {
    expect(extractNatalTableData("<div>nope</div>")).toBeNull();
  });
});

describe("scrape-first compute with fallback", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses formula when scrape disabled", async () => {
    vi.stubEnv("ENABLE_MYHORA_SCRAPE", "false");
    const chart = await computeNatalChart({ ...SAMPLE_INPUT });
    expect(chart.meta.calculationSource).toMatch(/formula-pipeline|suryayat-100/);
    expect(chart.planets).toHaveLength(10);
  });

  it("falls back to formula when scrape throws", async () => {
    vi.stubEnv("ENABLE_MYHORA_SCRAPE", "true");
    vi.stubEnv("MYHORA_ORIGIN", "http://127.0.0.1:9"); // closed port
    vi.stubEnv("MYHORA_SCRAPE_TIMEOUT_MS", "500");
    const chart = await computeNatalChart({ ...SAMPLE_INPUT });
    expect(chart.meta.calculationSource).toMatch(/formula-pipeline|suryayat-100/);
  });

  it("formula helper stays sync", () => {
    const chart = computeNatalChartFormula({ ...SAMPLE_INPUT });
    expect(chart.planets).toHaveLength(10);
  });
});
