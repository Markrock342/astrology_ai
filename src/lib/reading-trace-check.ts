import type { ReadingPromptTrace } from "@/types/reading-trace";

/**
 * Cheap, deterministic cross-check of an answer against what the model was
 * given. It cannot judge interpretation, but it catches the failure the team
 * actually fears: the answer naming a planet in a sign, or a lagna, that is
 * not in the tables — i.e. positions the model made up or pulled from
 * elsewhere. Heuristic by design; every flag carries the snippet to read.
 */

const PLANETS = [
  "อาทิตย์",
  "จันทร์",
  "อังคาร",
  "พุธ",
  "พฤหัสบดี",
  "พฤหัส",
  "ศุกร์",
  "เสาร์",
  "ราหู",
  "เกตุ",
  "มฤตยู",
] as const;

const SIGNS = [
  "เมษ",
  "พฤษภ",
  "มิถุน",
  "กรกฎ",
  "สิงห์",
  "กันย์",
  "ตุลย์",
  "พิจิก",
  "ธนู",
  "มกร",
  "กุมภ์",
  "มีน",
] as const;

const SIGN_ALIASES: Record<string, string> = {
  กุมภ: "กุมภ์",
  มังกร: "มกร",
  พฤษภ: "พฤษภ",
};

export type TraceCheckFlag = {
  kind: "planet_sign" | "lagna";
  detail: string;
  snippet: string;
};

export type TraceCheckResult = {
  /** Planet/sign pairs the answer mentions that agree with the tables. */
  confirmed: number;
  flags: TraceCheckFlag[];
};

function normalizePlanet(name: string): string {
  return name === "พฤหัส" ? "พฤหัสบดี" : name;
}

function normalizeSign(raw: string): string {
  const cleaned = raw.replace(/^ราศี/, "").trim();
  return SIGN_ALIASES[cleaned] ?? cleaned;
}

function allowedSigns(trace: ReadingPromptTrace, planet: string): Set<string> {
  const allowed = new Set<string>();
  for (const row of trace.natal.planets) {
    if (normalizePlanet(row.planet) === planet) allowed.add(normalizeSign(row.sign));
  }
  for (const row of trace.transit?.planets ?? []) {
    if (normalizePlanet(row.planet) === planet) allowed.add(normalizeSign(row.sign));
  }
  return allowed;
}

export function checkAnswerAgainstTrace(
  answer: string,
  trace: ReadingPromptTrace,
): TraceCheckResult {
  const text = answer ?? "";
  const flags: TraceCheckFlag[] = [];
  let confirmed = 0;

  // "ดาวเสาร์ … ราศีพฤษภ" within a short reach → the model is placing a planet.
  const planetAlt = PLANETS.join("|");
  const signAlt = SIGNS.map((s) => s.replace("์", "์?")).join("|");
  const placement = new RegExp(
    `(?:ดาว)?(${planetAlt})(?:\\s*\\([๐-๙0-9]\\))?[^\\n]{0,40}?ราศี\\s*(${signAlt}|กุมภ|มังกร)`,
    "g",
  );
  for (const match of text.matchAll(placement)) {
    const planet = normalizePlanet(match[1]!);
    const sign = normalizeSign(match[2]!);
    const allowed = allowedSigns(trace, planet);
    if (allowed.size === 0) continue; // planet not in tables at all — nothing to compare
    if (allowed.has(sign)) {
      confirmed += 1;
    } else {
      flags.push({
        kind: "planet_sign",
        detail: `${planet} ถูกกล่าวว่าอยู่ราศี${sign} แต่ในตารางอยู่ราศี${[...allowed].join("/")}`,
        snippet: match[0],
      });
    }
  }

  // "ลัคนา … ราศีตุลย์"
  const lagnaRe = new RegExp(`ลัคนา[^\\n]{0,30}?ราศี\\s*(${signAlt}|กุมภ|มังกร)`, "g");
  const natalLagna = normalizeSign(trace.natal.lagna);
  for (const match of text.matchAll(lagnaRe)) {
    const sign = normalizeSign(match[1]!);
    if (sign === natalLagna) {
      confirmed += 1;
    } else {
      flags.push({
        kind: "lagna",
        detail: `คำตอบบอกลัคนาราศี${sign} แต่พื้นดวงลัคนาราศี${natalLagna}`,
        snippet: match[0],
      });
    }
  }

  return { confirmed, flags };
}
