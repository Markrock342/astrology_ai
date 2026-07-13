import { createHash } from "crypto";
import type { BirthInputSnapshot, ChartJson } from "@/types/chart";
import type {
  CategoryFocus,
  MemoryHouseLord,
  MemoryPlanetInHouse,
  UserChartMemoryJson,
} from "@/types/chart-memory";
import { SIGNS } from "@/server/horoscope/engine/newhora/data/astrologyConstants";
import { houseFromLagna } from "@/server/horoscope/engine/format-chart-prompt";

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

const DIGNITY: Record<string, { own: string[]; exalt: string[]; fall: string[] }> = {
  อาทิตย์: { own: ["สิงห์"], exalt: ["เมษ"], fall: ["ตุลย์"] },
  จันทร์: { own: ["กรกฎ"], exalt: ["พฤษภ"], fall: ["พิจิก"] },
  อังคาร: { own: ["เมษ", "พิจิก"], exalt: ["มกร"], fall: ["กรกฎ"] },
  พุธ: { own: ["มิถุน", "กันย์"], exalt: ["กันย์"], fall: ["มีน"] },
  พฤหัสบดี: { own: ["ธนู", "มีน"], exalt: ["กรกฎ"], fall: ["มกร"] },
  ศุกร์: { own: ["พฤษภ", "ตุลย์"], exalt: ["มีน"], fall: ["กันย์"] },
  เสาร์: { own: ["มกร", "กุมภ"], exalt: ["ตุลย์"], fall: ["เมษ"] },
};

const CATEGORY_HOUSES = {
  career: [10, 6, 2],
  love: [7, 5],
  money: [2, 11],
  health: [1, 6, 8],
} as const;

export type MemoryCategoryKey = keyof typeof CATEGORY_HOUSES;

const MEMORY_CATEGORY_ORDER: MemoryCategoryKey[] = [
  "career",
  "love",
  "money",
  "health",
];

/** Topic hints in user text → memory focus (Thai + English). */
const TOPIC_HINTS: Record<MemoryCategoryKey, RegExp> = {
  career:
    /งาน|อาชีพ|เลื่อนตำแหน่ง|เปลี่ยนงาน|หัวหน้า|ลูกน้อง|ธุรกิจ|สมัครงาน|career|job|promotion/i,
  love: /รัก|คู่|แฟน|คนรัก|ความสัมพันธ์|แต่งงาน|คู่ครอง|เนื้อคู่|เลิก|love|relationship|marriage/i,
  money:
    /เงิน|การเงิน|รายได้|ลงทุน|หนี้|ออม|มรดก|โชคลาภ|fortune|finance|wealth|หุ้น|ค่าใช้จ่าย/i,
  health:
    /สุขภาพ|ป่วย|เจ็บ|ร่างกาย|จิตใจ|เครียด|stress|health|นอน|โรค|ออกกำลัง/i,
};

/** Thread slugs that always receive all category memory blocks. */
const ALL_MEMORY_SLUGS = /^(self|overview)$/i;

function dignityLabel(planet: string, sign: string): string {
  const d = DIGNITY[planet];
  if (!d) return "—";
  if (d.exalt.includes(sign)) return "อุจจ์";
  if (d.fall.includes(sign)) return "นีจ";
  if (d.own.includes(sign)) return "สวักษ์";
  return "ปกติ";
}

function signForHouse(lagna: string, house: number): string | null {
  const l = SIGNS.indexOf(lagna as (typeof SIGNS)[number]);
  if (l < 0 || house < 1 || house > 12) return null;
  return SIGNS[(l + house - 1) % 12] ?? null;
}

/** Stable hash of birth input — invalidate memory when birth changes. */
export function hashBirthInput(input: BirthInputSnapshot): string {
  const raw = [
    input.day,
    input.month,
    input.year,
    input.time,
    input.country,
    input.province,
    input.district,
  ].join("|");
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

function buildCategoryFocus(
  lagna: string,
  houses: readonly number[],
  planetRows: MemoryPlanetInHouse[],
  label: string,
): CategoryFocus {
  const planetsInHouses = planetRows.filter((p) => houses.includes(p.house));
  const houseLords: MemoryHouseLord[] = houses.map((house) => {
    const sign = signForHouse(lagna, house) ?? "—";
    const lord = SIGN_LORDS[sign] ?? "—";
    const lordRow = planetRows.find((p) => p.planet === lord);
    return {
      house,
      sign,
      lord,
      lordSign: lordRow?.sign ?? null,
      lordHouse: lordRow?.house ?? null,
    };
  });

  const summaryLines: string[] = [
    `${label}: เรือน ${houses.join(", ")} จากลัคนา${lagna}`,
  ];
  for (const h of houseLords) {
    const where =
      h.lordSign && h.lordHouse
        ? `${h.lord} อยู่${h.lordSign} (เรือน${h.lordHouse})`
        : `${h.lord} (ไม่พบตำแหน่งในตาราง)`;
    summaryLines.push(`- เรือน${h.house} (${h.sign}) เจ้าเรือน ${where}`);
  }
  if (planetsInHouses.length) {
    summaryLines.push(
      `- ดาวในเรือนโฟกัส: ${planetsInHouses
        .map((p) => `${p.planet}@เรือน${p.house}/${p.sign}(${p.dignity})`)
        .join("; ")}`,
    );
  } else {
    summaryLines.push("- ดาวในเรือนโฟกัส: ไม่มี");
  }

  return { houses: [...houses], planetsInHouses, houseLords, summaryLines };
}

/**
 * Derive durable chart memory from a READY engine natal chart.
 * Pure / sync — safe to call on every natal save.
 */
export function deriveChartMemory(chart: ChartJson): UserChartMemoryJson {
  const lagna = chart.chart?.lagna ?? chart.meta.lagna ?? "เมษ";
  const birthHash = hashBirthInput(chart.input);

  const planetRows: MemoryPlanetInHouse[] = chart.planets.map((p) => {
    const house = houseFromLagna(lagna, p.siderealSign) ?? 0;
    return {
      planet: p.planet,
      sign: p.siderealSign,
      house,
      dignity: dignityLabel(p.planet, p.siderealSign),
    };
  });

  const houseOccupants = Array.from({ length: 12 }, (_, i) => {
    const house = i + 1;
    const sign = signForHouse(lagna, house) ?? "—";
    return {
      house,
      sign,
      planets: planetRows.filter((p) => p.house === house).map((p) => p.planet),
    };
  });

  return {
    lagna,
    source: chart.meta.calculationSource,
    birthHash,
    computedAt: new Date().toISOString(),
    taksa: (chart.chart?.taksa ?? []).map((t) => ({ taksa: t.taksa, sign: t.sign })),
    houseOccupants,
    categories: {
      career: buildCategoryFocus(lagna, CATEGORY_HOUSES.career, planetRows, "งาน/อาชีพ"),
      love: buildCategoryFocus(lagna, CATEGORY_HOUSES.love, planetRows, "ความรัก"),
      money: buildCategoryFocus(lagna, CATEGORY_HOUSES.money, planetRows, "การเงิน"),
      health: buildCategoryFocus(lagna, CATEGORY_HOUSES.health, planetRows, "สุขภาพ"),
    },
  };
}

/** Map category slug → memory focus key. */
export function memoryKeyForCategory(
  categorySlug: string,
): MemoryCategoryKey | null {
  const s = categorySlug.toLowerCase();
  if (ALL_MEMORY_SLUGS.test(s)) return null;
  if (/career|งาน|อาชีพ|job/.test(s)) return "career";
  if (/love|รัก|คู่|relationship/.test(s)) return "love";
  if (/money|finance|เงิน|การเงิน|wealth|fortune|โชค/.test(s)) return "money";
  if (/health|สุขภาพ|body/.test(s)) return "health";
  return null;
}

/** Detect memory categories referenced in free-text questions. */
export function detectMemoryKeysFromText(text: string): MemoryCategoryKey[] {
  const hits: MemoryCategoryKey[] = [];
  for (const key of MEMORY_CATEGORY_ORDER) {
    if (TOPIC_HINTS[key].test(text)) hits.push(key);
  }
  return hits;
}

export type ResolveMemoryFocusInput = {
  categorySlug?: string | null;
  question?: string;
  /** Prior user turns in the same thread — enables cross-topic recall. */
  priorUserTexts?: string[];
};

/**
 * Pick which chart-memory focuses to inject.
 * Returns null → all categories (self / overview threads).
 */
export function resolveMemoryFocusKeys(
  input: ResolveMemoryFocusInput,
): MemoryCategoryKey[] | null {
  const slug = input.categorySlug?.trim();
  if (slug && ALL_MEMORY_SLUGS.test(slug)) return null;

  const threadKey = slug ? memoryKeyForCategory(slug) : null;
  const detected = new Set<MemoryCategoryKey>();
  if (threadKey) detected.add(threadKey);

  const texts = [
    input.question ?? "",
    ...(input.priorUserTexts ?? []),
  ].filter((t) => t.trim().length > 0);

  for (const text of texts) {
    for (const key of detectMemoryKeysFromText(text)) {
      detected.add(key);
    }
  }

  if (detected.size === 0) {
    return threadKey ? [threadKey] : null;
  }

  return MEMORY_CATEGORY_ORDER.filter((key) => detected.has(key));
}

export type FormatMemoryOptions = {
  categorySlug?: string | null;
  question?: string;
  priorUserTexts?: string[];
};

/** Format memory block for Gemini (engine facts only). */
export function formatMemoryForPrompt(
  memory: UserChartMemoryJson,
  options?: string | null | FormatMemoryOptions,
): string {
  const opts: FormatMemoryOptions =
    typeof options === "string" || options === null || options === undefined
      ? { categorySlug: options ?? undefined }
      : options;

  const lines: string[] = [
    "[memory] ความจำพื้นดวงผู้ใช้ (derive จาก engine — ใช้ประกอบการตอบ ห้ามแต่งดาว)",
    `ลัคนา: ${memory.lagna}`,
    `แหล่ง: ${memory.source ?? "engine"}`,
    `อัปเดต: ${memory.computedAt}`,
  ];

  if (memory.taksa.length) {
    lines.push(
      `ทักษา: ${memory.taksa.map((t) => `${t.taksa}=${t.sign}`).join(", ")}`,
    );
  }

  const focusKeys = resolveMemoryFocusKeys({
    categorySlug: opts.categorySlug,
    question: opts.question,
    priorUserTexts: opts.priorUserTexts,
  });
  const focuses = focusKeys
    ? focusKeys.map((key) => memory.categories[key])
    : Object.values(memory.categories);

  for (const focus of focuses) {
    lines.push("", ...focus.summaryLines);
  }

  return lines.join("\n");
}
