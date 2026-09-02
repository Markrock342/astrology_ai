import type { ChartJson } from "@/types/chart";
import { HOUSE_NAMES, houseFromLagna, SIGNS } from "@/lib/chart-theme";

const SIGN_LORDS: Record<string, string> = {
  เมษ: "อังคาร",
  พฤษภ: "ศุกร์",
  มิถุน: "พุธ",
  กรกฎ: "จันทร์",
  สิงห์: "อาทิตย์",
  กันย์: "พุธ",
  ตุลย์: "ศุกร์",
  พิจิก: "อังคาร",
  ธนู: "พฤหัสบดี",
  มกร: "เสาร์",
  กุมภ: "เสาร์",
  มีน: "พฤหัสบดี",
};

/** Natal houses shown per chat category — Free/Pro gating is applied in the UI. */
export const NATAL_FACT_HOUSES: Record<string, readonly number[]> = {
  self: [1],
  career: [10, 6, 2],
  finance: [2, 11],
  love: [7, 5],
  health: [1, 6, 8],
  fortune: [9, 11],
  overview: [1, 10, 7, 2],
};

export type NatalCategoryFact = {
  slug: string;
  houses: number[];
  lines: string[];
};

function signForHouse(lagna: string, house: number): string | null {
  const lagnaIndex = SIGNS.indexOf(lagna as (typeof SIGNS)[number]);
  if (lagnaIndex < 0 || house < 1 || house > 12) return null;
  return SIGNS[(lagnaIndex + house - 1) % 12] ?? null;
}

function houseLabel(house: number): string {
  const name = HOUSE_NAMES[house - 1];
  return name ? `เรือน ${house} ${name}` : `เรือน ${house}`;
}

/**
 * Deterministic natal facts for one life category, from the saved chart only.
 * Same house map the chat memory uses (career/love/money/health) plus self/fortune.
 */
export function natalFactsForCategory(
  chart: ChartJson,
  slug: string,
): NatalCategoryFact {
  const houses = [...(NATAL_FACT_HOUSES[slug] ?? NATAL_FACT_HOUSES.self)];
  const lagna = chart.chart?.lagna ?? chart.meta.lagna ?? "เมษ";
  const lines: string[] = [];

  if (slug === "self") {
    lines.push(`ลัคนา${lagna}`);
    if (chart.meta.birthDisplay) lines.push(chart.meta.birthDisplay);
  } else {
    lines.push(houses.map(houseLabel).join(" · "));
  }

  for (const house of houses) {
    const sign = signForHouse(lagna, house);
    if (!sign) continue;
    const lord = SIGN_LORDS[sign];
    const lordRow = lord
      ? chart.planets.find((planet) => planet.planet === lord)
      : undefined;
    const lordHouse = lordRow
      ? houseFromLagna(lagna, lordRow.siderealSign)
      : null;
    if (!lord) {
      lines.push(`${houseLabel(house)} ราศี${sign}`);
      continue;
    }
    lines.push(
      lordHouse
        ? `${houseLabel(house)} ราศี${sign} เจ้าเรือน${lord} อยู่เรือน ${lordHouse}`
        : `${houseLabel(house)} ราศี${sign} เจ้าเรือน${lord}`,
    );
  }

  const occupants = chart.planets.filter((planet) =>
    houses.includes(houseFromLagna(lagna, planet.siderealSign)),
  );
  lines.push(
    occupants.length
      ? `ดาวในเรือน: ${occupants.map((planet) => `${planet.planet} ${planet.siderealSign}`).join(" · ")}`
      : "ไม่มีดาวในเรือนโฟกัส",
  );

  return { slug, houses, lines };
}

export function natalSourceLabel(chart: ChartJson): string {
  return chart.meta.calculationSource === "myhora-scrape"
    ? "สมผุสจากตารางโหราศาสตร์ไทย"
    : "คำนวณจากสุริยยาตร์–ลาหิรี";
}

export function askPromptForNatalCategory(label: string): string {
  return `ขอสรุปพื้นดวงหมวด${label}`;
}
