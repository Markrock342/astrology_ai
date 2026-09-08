import type { PlanetSignRow } from "@/types/chart";
import { normalizeSignName, PLANET_ORDER, signIndex, SIGNS } from "@/lib/chart-theme";

export const ASPECT_KINDS = ["กุม", "เล็ง", "ตรีโกณ", "จตุโกณ"] as const;
export type AspectKind = (typeof ASPECT_KINDS)[number];

export type AspectBody = {
  name: string;
  sign: string;
  signIdx: number;
  degreeInSign: number;
  longitude: number;
};

export type ChartAspect = {
  kind: AspectKind;
  a: AspectBody;
  b: AspectBody;
  /** Whole-sign house of B counted from A (1 = same sign, 7 = opposite). */
  houseFromA: number;
  /** Shortest ecliptic separation in degrees (0–180). */
  degreeSep: number;
};

/** Degrees inside a 30° rasi. Missing values sit at the sign midpoint. */
export function clampDegreeInSign(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return 15;
  return Math.min(30, Math.max(0, value));
}

export function absoluteLongitude(sign: string, degreeInSign?: number | null): number {
  const idx = signIndex(sign);
  return idx * 30 + clampDegreeInSign(degreeInSign);
}

export function shortestDegreeSep(a: number, b: number): number {
  const raw = Math.abs(a - b) % 360;
  return raw > 180 ? 360 - raw : raw;
}

/**
 * Thai inclusive house count from A to B.
 * Same rasi = 1, next = 2, opposite = 7.
 */
export function houseFromSign(fromSign: string, toSign: string): number {
  const from = signIndex(fromSign);
  const to = signIndex(toSign);
  return ((to - from + 12) % 12) + 1;
}

export function aspectKindFromHouse(house: number): AspectKind | null {
  if (house === 1) return "กุม";
  if (house === 7) return "เล็ง";
  if (house === 5 || house === 9) return "ตรีโกณ";
  if (house === 4 || house === 10) return "จตุโกณ";
  return null;
}

/**
 * Polar angle for the rasi wheel: Aries at top, signs run counterclockwise.
 * 0° of a sign sits on the previous-sign boundary; 30° on the next-sign boundary.
 */
export function signWheelAngle(signIdx: number, degreeInSign: number): number {
  const start = 15 - signIdx * 30;
  return start - clampDegreeInSign(degreeInSign);
}

function bodyFromPlanet(row: PlanetSignRow): AspectBody | null {
  const sign = normalizeSignName(row.siderealSign);
  if (!(SIGNS as readonly string[]).includes(sign)) return null;
  const degreeInSign = clampDegreeInSign(row.degreeInSign);
  return {
    name: row.planet,
    sign,
    signIdx: signIndex(sign),
    degreeInSign,
    longitude: absoluteLongitude(sign, degreeInSign),
  };
}

function bodyFromLagna(
  lagna: string | null | undefined,
  degreeInSign?: number | null,
): AspectBody | null {
  if (!lagna) return null;
  const sign = normalizeSignName(lagna);
  if (!(SIGNS as readonly string[]).includes(sign)) return null;
  const degree = clampDegreeInSign(degreeInSign ?? 15);
  return {
    name: "ลัคนา",
    sign,
    signIdx: signIndex(sign),
    degreeInSign: degree,
    longitude: absoluteLongitude(sign, degree),
  };
}

function rankName(name: string): number {
  if (name === "ลัคนา") return -1;
  const idx = PLANET_ORDER.indexOf(name as (typeof PLANET_ORDER)[number]);
  return idx >= 0 ? idx : 99;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function computeChartAspects(
  planets: PlanetSignRow[],
  lagna?: string | null,
  lagnaDegreeInSign?: number | null,
): ChartAspect[] {
  const bodies: AspectBody[] = [];
  const lagnaBody = bodyFromLagna(lagna, lagnaDegreeInSign);
  if (lagnaBody) bodies.push(lagnaBody);
  for (const row of planets) {
    const body = bodyFromPlanet(row);
    if (body) bodies.push(body);
  }

  const found = new Map<string, ChartAspect>();
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i]!;
      const b = bodies[j]!;
      if (a.name === b.name) continue;
      const house = houseFromSign(a.sign, b.sign);
      const kind = aspectKindFromHouse(house);
      if (!kind) continue;
      if (kind === "กุม" && a.sign !== b.sign) continue;
      const [left, right] =
        rankName(a.name) <= rankName(b.name) ? [a, b] : [b, a];
      const key = `${kind}:${pairKey(left.name, right.name)}`;
      found.set(key, {
        kind,
        a: left,
        b: right,
        houseFromA: houseFromSign(left.sign, right.sign),
        degreeSep: shortestDegreeSep(left.longitude, right.longitude),
      });
    }
  }

  const kindRank = new Map(ASPECT_KINDS.map((kind, idx) => [kind, idx]));
  return [...found.values()].sort((x, y) => {
    const kr = (kindRank.get(x.kind) ?? 9) - (kindRank.get(y.kind) ?? 9);
    if (kr !== 0) return kr;
    const pr = rankName(x.a.name) - rankName(y.a.name);
    if (pr !== 0) return pr;
    return rankName(x.b.name) - rankName(y.b.name);
  });
}

export function formatAspectsForPrompt(aspects: ChartAspect[]): string[] {
  if (!aspects.length) {
    return [
      "",
      "[aspects] มุมสัมพันธ์ที่คำนวณจากราศีและองศา (ใช้ตารางนี้เท่านั้น ห้ามเดามุม):",
      "- ไม่มีมุมกุม เล็ง ตรีโกณ จตุโกณ",
    ];
  }
  const lines = [
    "",
    "[aspects] มุมสัมพันธ์ที่คำนวณจากราศีและองศา (ใช้ตารางนี้เท่านั้น ห้ามเดามุม):",
  ];
  for (const kind of ASPECT_KINDS) {
    const rows = aspects.filter((item) => item.kind === kind);
    if (!rows.length) {
      lines.push(`- ${kind}: ไม่มี`);
      continue;
    }
    lines.push(
      `- ${kind}: ${rows
        .map(
          (item) =>
            `${item.a.name}–${item.b.name} (เรือน${item.houseFromA} ห่าง ${item.degreeSep.toFixed(1)}°)`,
        )
        .join("; ")}`,
    );
  }
  return lines;
}

export function formatAspectsCompactForPrompt(aspects: ChartAspect[]): string[] {
  if (!aspects.length) {
    return ["[aspects] มุมจากองศา (ห้ามเดา): ไม่มีกุม เล็ง ตรีโกณ จตุโกณ"];
  }
  return [
    `[aspects] มุมจากองศา (ห้ามเดา): ${aspects
      .map((item) => `${item.kind} ${item.a.name}–${item.b.name}`)
      .join(" · ")}`,
  ];
}
