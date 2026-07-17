import type { ChartJson } from "@/types/chart";
import type { MyhoraNatalPlanet, MyhoraTaksaCell, MyhoraTriwaiCell } from "@/types/myhora";
import { SIGNS } from "@/server/horoscope/engine/newhora/data/astrologyConstants";
import { MYHORA_PLANET_NUM } from "@/server/horoscope/engine/myhora/sign-codes";

export type FormatChartOptions = {
  /** Heading for this chart block (natal vs transit). */
  title?: string;
  /** Prefer transit samrap rows from myhora when formatting a transit chart. */
  preferTransitSamrap?: boolean;
};

const SIGN_INDEX = new Map(SIGNS.map((s, i) => [s, i]));

/** House 1–12 counted from lagna (Thai whole-sign). */
export function houseFromLagna(lagna: string, planetSign: string): number | null {
  const l = SIGN_INDEX.get(lagna as (typeof SIGNS)[number]);
  const p = SIGN_INDEX.get(planetSign as (typeof SIGNS)[number]);
  if (l === undefined || p === undefined) return null;
  return ((p - l + 12) % 12) + 1;
}

const DIGNITY: Record<string, { own: string[]; exalt: string[]; fall: string[] }> = {
  อาทิตย์: { own: ["สิงห์"], exalt: ["เมษ"], fall: ["ตุลย์"] },
  จันทร์: { own: ["กรกฎ"], exalt: ["พฤษภ"], fall: ["พิจิก"] },
  อังคาร: { own: ["เมษ", "พิจิก"], exalt: ["มกร"], fall: ["กรกฎ"] },
  พุธ: { own: ["มิถุน", "กันย์"], exalt: ["กันย์"], fall: ["มีน"] },
  พฤหัสบดี: { own: ["ธนู", "มีน"], exalt: ["กรกฎ"], fall: ["มกร"] },
  ศุกร์: { own: ["พฤษภ", "ตุลย์"], exalt: ["มีน"], fall: ["กันย์"] },
  เสาร์: { own: ["มกร", "กุมภ์"], exalt: ["ตุลย์"], fall: ["เมษ"] },
};

function dignityLabel(planet: string, sign: string): string {
  const d = DIGNITY[planet];
  if (!d) return "—";
  if (d.exalt.includes(sign)) return "อุจจ์";
  if (d.fall.includes(sign)) return "นีจ";
  if (d.own.includes(sign)) return "สวักษ์";
  return "ปกติ";
}

function pad(s: string, n: number): string {
  const t = s.slice(0, n);
  return t + " ".repeat(Math.max(0, n - [...t].length));
}

function formatSamrapTable(rows: MyhoraNatalPlanet[]): string[] {
  const lines = [
    "ตารางสมผุส:",
    `${pad("ดาว", 12)} | ${pad("ราศี", 8)} | ${pad("องศา", 6)} | ${pad("เรือน", 5)} | ${pad("นวางศ์", 6)} | ${pad("ฤกษ์", 8)} | มาตรฐานฤกษ์`,
    `${"-".repeat(12)}-+-${"-".repeat(8)}-+-${"-".repeat(6)}-+-${"-".repeat(5)}-+-${"-".repeat(6)}-+-${"-".repeat(8)}-+-${"-".repeat(10)}`,
  ];
  for (const r of rows) {
    const deg =
      r.degree || r.minute
        ? `${r.degree || "0"}°${r.minute || "0"}'`
        : "—";
    lines.push(
      `${pad(r.planet, 12)} | ${pad(r.zodiac, 8)} | ${pad(deg, 6)} | ${pad(r.house || "—", 5)} | ${pad(
        r.nawamang || "—",
        6,
      )} | ${pad(r.rerkName || r.rerk || "—", 8)} | ${r.rerkStandard || "—"}`,
    );
  }
  return lines;
}

function formatTaksaGrid(taksa: (MyhoraTaksaCell | null)[][]): string[] {
  if (!taksa.length) return [];
  const lines = ["", "ทักษา:"];
  for (const row of taksa) {
    const cells = row
      .filter(Boolean)
      .map((c) => {
        const p = c!.planetNum != null ? MYHORA_PLANET_NUM[c!.planetNum] ?? String(c!.planetNum) : "";
        const t = c!.transitLabel ? `/${c!.transitLabel}` : "";
        return `${c!.label || "·"}${p ? `(${p})` : ""}${t}`;
      });
    if (cells.length) lines.push(`- ${cells.join(" | ")}`);
  }
  return lines;
}

function formatTriwaiGrid(
  label: string,
  grid: (MyhoraTriwaiCell | null)[][],
): string[] {
  if (!grid.length) return [];
  const lines = ["", `${label}:`];
  for (const row of grid) {
    for (const cell of row) {
      if (!cell) continue;
      const planet = MYHORA_PLANET_NUM[cell.planetNum] ?? String(cell.planetNum);
      const mark = cell.highlighted ? " ★" : "";
      lines.push(`- เรือน${cell.house}: ${planet} อายุ ${cell.ageRange}${mark}`);
    }
  }
  return lines;
}

function formatDateDetail(chart: ChartJson, kind: "natal" | "transit"): string[] {
  const detail =
    kind === "natal"
      ? chart.myhora?.dateDetailNatal
      : chart.myhora?.dateDetailTransit;
  if (!detail?.lines?.length) return [];
  return ["", detail.title || (kind === "natal" ? "ดวงกำเนิด" : "ดวงจร"), ...detail.lines.map((l) => `- ${l.text}`)];
}

/**
 * Turn chartJson into a readable Thai table for the AI prompt.
 * Prefer structured evidence rows when present.
 */
export function formatChartForPrompt(
  chart: ChartJson,
  options: FormatChartOptions = {},
): string {
  const title =
    options.title ??
    "[natal] พื้นดวง (ใช้ตารางนี้เท่านั้น ห้ามแต่งดาว)";

  const lagna = chart.chart?.lagna ?? chart.meta.lagna ?? "—";
  const lines: string[] = [title, `ลัคนา: ${lagna}`];

  if (chart.meta.birthDisplay) lines.push(`วันเวลา: ${chart.meta.birthDisplay}`);
  if (chart.meta.locationDisplay) lines.push(`สถานที่: ${chart.meta.locationDisplay}`);

  lines.push(...formatDateDetail(chart, options.preferTransitSamrap ? "transit" : "natal"));

  const samrap = options.preferTransitSamrap
    ? chart.myhora?.transitPlanets
    : chart.myhora?.natalPlanets;

  if (samrap?.length) {
    lines.push("", ...formatSamrapTable(samrap));
  } else {
    lines.push(
      "",
      "ตารางตำแหน่งดาว:",
      `${pad("ดาว", 10)} | ${pad("ราศี", 8)} | ${pad("องศา", 10)} | ${pad("เรือน", 5)} | มาตรฐาน`,
      `${"-".repeat(10)}-+-${"-".repeat(8)}-+-${"-".repeat(10)}-+-${"-".repeat(5)}-+-${"-".repeat(8)}`,
    );

    const rows = chart.planets.map((p) => {
      const house = houseFromLagna(lagna, p.siderealSign);
      return {
        planet: p.planet,
        sign: p.siderealSign,
        deg: p.degreeText ?? (p.degreeInSign != null ? `${p.degreeInSign.toFixed(1)}°` : "—"),
        house,
        dignity: dignityLabel(p.planet, p.siderealSign),
      };
    });

    for (const r of rows) {
      lines.push(
        `${pad(r.planet, 10)} | ${pad(r.sign, 8)} | ${pad(r.deg, 10)} | ${pad(
          r.house != null ? String(r.house) : "—",
          5,
        )} | ${r.dignity}`,
      );
    }

    // Relations only for formula path (samrap already has house/nawamang).
    const sameSign = new Map<string, string[]>();
    for (const r of rows) {
      const list = sameSign.get(r.sign) ?? [];
      list.push(r.planet);
      sameSign.set(r.sign, list);
    }
    const coLocated = [...sameSign.entries()]
      .filter(([, planets]) => planets.length > 1)
      .map(([sign, planets]) => `${planets.join("+")} ใน${sign}`);

    lines.push("", "สัมพันธ์ดาว (จากตาราง):");
    lines.push(
      coLocated.length
        ? `- ดาวร่วมราศี: ${coLocated.join("; ")}`
        : "- ดาวร่วมราศี: ไม่มี",
    );
  }

  if (chart.myhora?.taksa?.length) {
    lines.push(...formatTaksaGrid(chart.myhora.taksa));
  } else if (chart.chart?.taksa?.length) {
    lines.push("", "ทักษา (จากลัคนา):");
    lines.push(`${pad("ทักษา", 12)} | ราศี`);
    lines.push(`${"-".repeat(12)}-+-${"-".repeat(8)}`);
    for (const t of chart.chart.taksa) {
      lines.push(`${pad(t.taksa, 12)} | ${t.sign}`);
    }
  }

  if (chart.myhora?.triwaiNatal?.length) {
    lines.push(...formatTriwaiGrid("ตรีวัยพื้นดวง", chart.myhora.triwaiNatal));
  }
  if (options.preferTransitSamrap && chart.myhora?.triwaiTransit?.length) {
    lines.push(...formatTriwaiGrid("ตรีวัยดวงจร", chart.myhora.triwaiTransit));
  }

  if (chart.myhora?.summaryNatal && !options.preferTransitSamrap) {
    lines.push("", `สรุป: ${chart.myhora.summaryNatal}`);
  }
  if (chart.myhora?.summaryTransit && options.preferTransitSamrap) {
    lines.push("", `สรุปดวงจร: ${chart.myhora.summaryTransit}`);
  }

  return lines.join("\n");
}

/**
 * Compact natal block for follow-up turns — keeps [natal] marker and planet
 * positions without full samrap/taksa/triwai tables (~10 lines vs ~50+).
 */
export function formatChartCompactForPrompt(
  chart: ChartJson,
  options: FormatChartOptions = {},
): string {
  const title =
    options.title ??
    "[natal] พื้นดวงจาก engine (ย่อ — ใช้ตำแหน่งดาวนี้เท่านั้น ห้ามแต่งดาว)";
  const lagna = chart.chart?.lagna ?? chart.meta.lagna ?? "—";
  const lines: string[] = [title, `ลัคนา: ${lagna}`];

  const samrap = options.preferTransitSamrap
    ? chart.myhora?.transitPlanets
    : chart.myhora?.natalPlanets;

  if (samrap?.length) {
    for (const r of samrap) {
      lines.push(
        `${r.planet}: ${r.zodiac} เรือน${r.house ?? "—"}${r.rerkStandard ? ` (${r.rerkStandard})` : ""}`,
      );
    }
  } else {
    for (const p of chart.planets) {
      const house = houseFromLagna(lagna, p.siderealSign);
      const dignity = dignityLabel(p.planet, p.siderealSign);
      lines.push(
        `${p.planet}: ${p.siderealSign} เรือน${house ?? "—"} (${dignity})`,
      );
    }
  }

  return lines.join("\n");
}
