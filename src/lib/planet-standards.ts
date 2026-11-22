import { z } from "zod";

/**
 * ตารางมาตรฐานดาว — the team's own table, edited in Admin → มาตรฐานดาว
 * (A, 22 Nov 2026: "ทำแยกไว้ เผื่อ ai จะอ่านง่ายกว่า").
 *
 * Sign lords and every planet's standards used to be constants in code, so
 * the knowledge base could say "ราหู เกษตรราศีกุมภ์" while the chart table,
 * the house chains and the prompt all said เสาร์. Now one table drives all of
 * them. Pure and isomorphic: the server loads the saved table and applies it;
 * the chart table on the page fetches the same one.
 */

/** Signs as the dignity code compares them (no trailing ์). */
export const STANDARD_SIGNS = [
  "เมษ", "พฤษภ", "มิถุน", "กรกฎ", "สิงห", "กันย",
  "ตุลย", "พิจิก", "ธนู", "มกร", "กุมภ", "มีน",
] as const;
export type StandardSign = (typeof STANDARD_SIGNS)[number];

/** How each sign is shown to people and to the model. */
export const SIGN_DISPLAY: Record<StandardSign, string> = {
  เมษ: "เมษ", พฤษภ: "พฤษภ", มิถุน: "มิถุน", กรกฎ: "กรกฎ", สิงห: "สิงห์", กันย: "กันย์",
  ตุลย: "ตุลย์", พิจิก: "พิจิก", ธนู: "ธนู", มกร: "มกร", กุมภ: "กุมภ์", มีน: "มีน",
};

export const STANDARD_PLANETS = [
  "อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "ราหู", "เกตุ", "มฤตยู",
] as const;
export type StandardPlanet = (typeof STANDARD_PLANETS)[number];

/** Columns of the table, strongest first; the first four make the one-word มาตรฐาน. */
export const STANDARD_KINDS = ["อุจจ์", "นิจ", "เกษตร", "ประ", "มหาจักร", "ราชาโชค", "เทวีโชค", "จุลจักร"] as const;
export type StandardKind = (typeof STANDARD_KINDS)[number];
export const EXTRA_STANDARD_KINDS = ["มหาจักร", "ราชาโชค", "เทวีโชค", "จุลจักร"] as const satisfies readonly StandardKind[];

export type PlanetStandardsTable = {
  /** เจ้าเรือน of each sign. */
  lords: Record<StandardSign, StandardPlanet>;
  /** A sign's older lord, kept alongside (กุมภ์ → เสาร์). */
  originalLords: Partial<Record<StandardSign, StandardPlanet>>;
  planets: Record<StandardPlanet, Record<StandardKind, StandardSign[]>>;
};

const isSign = (v: unknown): v is StandardSign => typeof v === "string" && (STANDARD_SIGNS as readonly string[]).includes(v);
const isPlanet = (v: unknown): v is StandardPlanet => typeof v === "string" && (STANDARD_PLANETS as readonly string[]).includes(v);

/** Checks a whole table; returns it cleaned (deduplicated, in sign order) or an error message. */
export function validatePlanetStandards(value: unknown): { ok: true; table: PlanetStandardsTable } | { ok: false; error: string } {
  if (!value || typeof value !== "object") return { ok: false, error: "ไม่มีตาราง" };
  const v = value as { lords?: Record<string, unknown>; originalLords?: Record<string, unknown>; planets?: Record<string, Record<string, unknown>> };
  const lords = {} as PlanetStandardsTable["lords"];
  for (const s of STANDARD_SIGNS) {
    const lord = v.lords?.[s];
    if (!isPlanet(lord)) return { ok: false, error: `ราศี${SIGN_DISPLAY[s]}ยังไม่มีเจ้าเรือน` };
    lords[s] = lord;
  }
  const originalLords: PlanetStandardsTable["originalLords"] = {};
  for (const [s, lord] of Object.entries(v.originalLords ?? {})) {
    if (!isSign(s)) return { ok: false, error: `ไม่รู้จักราศี ${s}` };
    if (lord === null || lord === "" || lord === undefined) continue;
    if (!isPlanet(lord)) return { ok: false, error: `เจ้าเรือนเดิมของ${SIGN_DISPLAY[s]}ไม่ถูกต้อง` };
    if (lord !== lords[s]) originalLords[s] = lord;
  }
  const planets = {} as PlanetStandardsTable["planets"];
  for (const p of STANDARD_PLANETS) {
    const cols = {} as Record<StandardKind, StandardSign[]>;
    for (const k of STANDARD_KINDS) {
      const raw = v.planets?.[p]?.[k] ?? [];
      if (!Array.isArray(raw) || !raw.every(isSign)) return { ok: false, error: `${p} · ${k}: ราศีไม่ถูกต้อง` };
      cols[k] = STANDARD_SIGNS.filter((s) => raw.includes(s));
    }
    planets[p] = cols;
  }
  return { ok: true, table: { lords, originalLords, planets } };
}

export const planetStandardsSchema = z.unknown().transform((value, ctx) => {
  const result = validatePlanetStandards(value);
  if (!result.ok) {
    ctx.addIssue({ code: "custom", message: result.error });
    return z.NEVER;
  }
  return result.table;
});

const opposite = (sign: StandardSign): StandardSign => STANDARD_SIGNS[(STANDARD_SIGNS.indexOf(sign) + 6) % 12]!;
const row = (own: StandardSign[], exalt: StandardSign[], fall: StandardSign[]): Record<StandardKind, StandardSign[]> => ({
  อุจจ์: exalt, นิจ: fall, เกษตร: own, ประ: own.map(opposite),
  มหาจักร: [], ราชาโชค: [], เทวีโชค: [], จุลจักร: [],
});

/**
 * What the app used before the table was editable. ประ is the sign opposite
 * each เกษตร, as the ตำรา in the knowledge base defines it. ราหู holds กุมภ์
 * (HoraSard's setting "ราหู (๘): เกษตรราศีกุมภ์"), เสาร์ keeps it as its
 * เจ้าเรือนเดิม. The four เกณฑ์ columns start empty for the team to fill.
 */
export const DEFAULT_PLANET_STANDARDS: PlanetStandardsTable = {
  lords: {
    เมษ: "อังคาร", พฤษภ: "ศุกร์", มิถุน: "พุธ", กรกฎ: "จันทร์", สิงห: "อาทิตย์", กันย: "พุธ",
    ตุลย: "ศุกร์", พิจิก: "อังคาร", ธนู: "พฤหัสบดี", มกร: "เสาร์", กุมภ: "ราหู", มีน: "พฤหัสบดี",
  },
  originalLords: { กุมภ: "เสาร์" },
  planets: {
    อาทิตย์: row(["สิงห"], ["เมษ"], ["ตุลย"]),
    จันทร์: row(["กรกฎ"], ["พฤษภ"], ["พิจิก"]),
    อังคาร: row(["เมษ", "พิจิก"], ["มกร"], ["กรกฎ"]),
    พุธ: row(["มิถุน", "กันย"], ["กันย"], ["มีน"]),
    พฤหัสบดี: row(["ธนู", "มีน"], ["กรกฎ"], ["มกร"]),
    ศุกร์: row(["พฤษภ", "ตุลย"], ["มีน"], ["กันย"]),
    เสาร์: row(["มกร", "กุมภ"], ["ตุลย"], ["เมษ"]),
    ราหู: row(["กุมภ"], [], []),
    เกตุ: row([], [], []),
    มฤตยู: row([], [], []),
  },
};

/** A saved value, or the defaults where it is missing or malformed. */
export function parsePlanetStandards(value: unknown): PlanetStandardsTable {
  const result = validatePlanetStandards(value);
  return result.ok ? result.table : DEFAULT_PLANET_STANDARDS;
}

let active: PlanetStandardsTable = DEFAULT_PLANET_STANDARDS;
let activeVersion = versionOf(DEFAULT_PLANET_STANDARDS);

/** Make `table` the one every lord and dignity lookup reads. */
export function applyPlanetStandards(table: PlanetStandardsTable) {
  active = table;
  activeVersion = versionOf(table);
}
export function activePlanetStandards(): PlanetStandardsTable {
  return active;
}
/** Changes whenever the table does — chart memory derived under another table is stale. */
export function planetStandardsVersion(): string {
  return activeVersion;
}

function versionOf(table: PlanetStandardsTable): string {
  // A small stable hash (FNV-1a) — runs in the browser too, so no node:crypto.
  const text = JSON.stringify(table);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

const planetKey = (planet: string): StandardPlanet | null => {
  const name = planet === "พฤหัส" ? "พฤหัสบดี" : planet.replace(/\s*\(.*\)$/, "").trim();
  return (STANDARD_PLANETS as readonly string[]).includes(name) ? (name as StandardPlanet) : null;
};

/** Every column of the table this planet meets in `sign`, strongest first. */
export function standardsOf(planet: string, sign: string): StandardKind[] {
  const p = planetKey(planet);
  if (!p) return [];
  const s = sign as StandardSign;
  const cols = active.planets[p];
  return STANDARD_KINDS.filter((k) => cols[k].includes(s));
}

/** Whether the table says anything at all about this planet. */
export function hasStandards(planet: string): boolean {
  const p = planetKey(planet);
  return Boolean(p && STANDARD_KINDS.some((k) => active.planets[p][k].length));
}

/**
 * The table as the model reads it: one line per planet, then the lords.
 * Only what is filled in — an empty column says nothing.
 */
export function formatPlanetStandardsForPrompt(table: PlanetStandardsTable = active): string[] {
  const lines = ["[standards] ตารางมาตรฐานดาวของทีม (ใช้เป็นหลักเรื่องเจ้าเรือนและมาตรฐานดาว ห้ามใช้ตารางอื่น):"];
  for (const p of STANDARD_PLANETS) {
    const parts = STANDARD_KINDS.filter((k) => table.planets[p][k].length).map(
      (k) => `${k} ${table.planets[p][k].map((s) => SIGN_DISPLAY[s]).join(", ")}`,
    );
    if (parts.length) lines.push(`- ${p}: ${parts.join(" · ")}`);
  }
  lines.push(
    `- เจ้าเรือน: ${STANDARD_SIGNS.map((s) => {
      const original = table.originalLords[s];
      return `${SIGN_DISPLAY[s]} ${table.lords[s]}${original ? ` (เจ้าเรือนเดิม ${original})` : ""}`;
    }).join(" · ")}`,
  );
  return lines;
}
