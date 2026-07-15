/** Planet symbols/colors for chart UI (client-safe). */
export const PLANET_THEME: Record<
  string,
  { symbol: string; color: string; glow: string }
> = {
  อาทิตย์: { symbol: "☉", color: "#f5a623", glow: "rgba(245,166,35,0.35)" },
  จันทร์: { symbol: "☽", color: "#e8eef8", glow: "rgba(232,238,248,0.3)" },
  อังคาร: { symbol: "♂", color: "#e85d4a", glow: "rgba(232,93,74,0.3)" },
  พุธ: { symbol: "☿", color: "#7ec8a8", glow: "rgba(126,200,168,0.3)" },
  พฤหัสบดี: { symbol: "♃", color: "#d4a84b", glow: "rgba(212,168,75,0.35)" },
  ศุกร์: { symbol: "♀", color: "#e8a0c8", glow: "rgba(232,160,200,0.3)" },
  เสาร์: { symbol: "♄", color: "#8b9dc3", glow: "rgba(139,157,195,0.3)" },
  ราหู: { symbol: "☊", color: "#9b7ed9", glow: "rgba(155,126,217,0.35)" },
  เกตุ: { symbol: "☋", color: "#b8a088", glow: "rgba(184,160,136,0.3)" },
  มฤตยู: { symbol: "♅", color: "#5eb8d4", glow: "rgba(94,184,212,0.3)" },
};

export const SIGN_THEME: Record<string, { hue: string; bg: string }> = {
  เมษ: { hue: "#e85d4a", bg: "rgba(232,93,74,0.15)" },
  พฤษภ: { hue: "#7ec87a", bg: "rgba(126,200,122,0.15)" },
  มิถุน: { hue: "#f5d76e", bg: "rgba(245,215,110,0.15)" },
  กรกฎ: { hue: "#e8eef8", bg: "rgba(232,238,248,0.12)" },
  สิงห์: { hue: "#f5a623", bg: "rgba(245,166,35,0.15)" },
  กันย์: { hue: "#a8c878", bg: "rgba(168,200,120,0.15)" },
  ตุลย์: { hue: "#e8a0c8", bg: "rgba(232,160,200,0.15)" },
  พิจิก: { hue: "#9b4a6a", bg: "rgba(155,74,106,0.15)" },
  ธนู: { hue: "#9b7ed9", bg: "rgba(155,126,217,0.15)" },
  มกร: { hue: "#6a5a4a", bg: "rgba(106,90,74,0.2)" },
  กุมภ: { hue: "#5eb8d4", bg: "rgba(94,184,212,0.15)" },
  มีน: { hue: "#7a9eb8", bg: "rgba(122,158,184,0.15)" },
};

export const SIGNS = [
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
  "กุมภ",
  "มีน",
] as const;

export function getPlanetTheme(planet: string) {
  return (
    PLANET_THEME[planet] ?? {
      symbol: "✦",
      color: "#d4a84b",
      glow: "rgba(212,168,75,0.25)",
    }
  );
}

export function getSignTheme(sign: string) {
  return SIGN_THEME[sign] ?? { hue: "#d4a84b", bg: "rgba(212,168,75,0.12)" };
}

/**
 * myhora rows store signs as "07 : พจ" — a 0-based sign index plus an
 * abbreviation. Users (and the wheel's name lookup) need the full name;
 * the numeric index is authoritative, the abbreviation is just a hint.
 * Full names pass through untouched.
 */
export function normalizeSignName(raw: string): string {
  if ((SIGNS as readonly string[]).includes(raw)) return raw;
  const m = /^(\d{1,2})\s*:/.exec(raw.trim());
  if (m) {
    const idx = Number(m[1]);
    if (idx >= 0 && idx < 12) return SIGNS[idx];
  }
  return raw;
}

export function signIndex(sign: string): number {
  const i = SIGNS.indexOf(normalizeSignName(sign) as (typeof SIGNS)[number]);
  return i >= 0 ? i : 0;
}

export function houseFromLagna(lagnaSign: string, planetSign: string): number {
  const lagnaIdx = signIndex(lagnaSign);
  const planetIdx = signIndex(planetSign);
  return ((planetIdx - lagnaIdx + 12) % 12) + 1;
}
