/** Derive CSS theme tokens from brand color picks. Server-safe (no DOM). */

export type BrandColors = {
  primary: string;
  secondary: string;
  background: string;
};

export const DEFAULT_BRAND_COLORS: BrandColors = {
  primary: "#c9a24b",
  secondary: "#1f8f7a",
  background: "#0d0d0f",
};

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function normalizeHex(input: string, fallback: string): string {
  const raw = input.trim();
  if (!HEX.test(raw)) return fallback;
  if (raw.length === 4) {
    const r = raw[1]!;
    const g = raw[2]!;
    const b = raw[3]!;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return raw.toLowerCase();
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = normalizeHex(hex, "#000000").slice(1);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return (
    "#" +
    [clamp(r), clamp(g), clamp(b)]
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("")
  );
}

function mix(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
  t: number,
) {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }) {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastInk(hex: string): string {
  return relativeLuminance(hexToRgb(hex)) > 0.45 ? "#1a1508" : "#f5f5f7";
}

function lighten(hex: string, amount: number): string {
  const c = mix(hexToRgb(hex), { r: 255, g: 255, b: 255 }, amount);
  return rgbToHex(c.r, c.g, c.b);
}

function darken(hex: string, amount: number): string {
  const c = mix(hexToRgb(hex), { r: 0, g: 0, b: 0 }, amount);
  return rgbToHex(c.r, c.g, c.b);
}

function rgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Build CSS custom-property map from brand picks. */
export function buildThemeVars(colors: BrandColors): Record<string, string> {
  const primary = normalizeHex(colors.primary, DEFAULT_BRAND_COLORS.primary);
  const secondary = normalizeHex(
    colors.secondary,
    DEFAULT_BRAND_COLORS.secondary,
  );
  const background = normalizeHex(
    colors.background,
    DEFAULT_BRAND_COLORS.background,
  );

  const bg = hexToRgb(background);
  const darkBase = relativeLuminance(bg) < 0.45;
  const ink = darkBase
    ? { r: 236, g: 236, b: 242 }
    : { r: 22, g: 24, b: 29 };
  const muteMix = darkBase ? 0.42 : 0.38;
  const mute2Mix = darkBase ? 0.58 : 0.55;

  const surface = mix(bg, ink, darkBase ? 0.06 : 0.04);
  const surface2 = mix(bg, ink, darkBase ? 0.12 : 0.08);
  const surface3 = mix(bg, ink, darkBase ? 0.18 : 0.14);
  const border = mix(bg, ink, darkBase ? 0.22 : 0.2);
  const muted = mix(ink, bg, muteMix);
  const muted2 = mix(ink, bg, mute2Mix);

  const primaryHover = darkBase ? lighten(primary, 0.12) : darken(primary, 0.1);
  const secondaryActive = darkBase
    ? lighten(secondary, 0.14)
    : darken(secondary, 0.08);

  return {
    "--background": background,
    "--surface": rgbToHex(surface.r, surface.g, surface.b),
    "--surface-2": rgbToHex(surface2.r, surface2.g, surface2.b),
    "--surface-3": rgbToHex(surface3.r, surface3.g, surface3.b),
    "--border": rgbToHex(border.r, border.g, border.b),
    "--foreground": rgbToHex(ink.r, ink.g, ink.b),
    "--muted": rgbToHex(muted.r, muted.g, muted.b),
    "--muted-2": rgbToHex(muted2.r, muted2.g, muted2.b),
    "--primary": primary,
    "--primary-hover": primaryHover,
    "--primary-foreground": contrastInk(primary),
    "--accent": primary,
    "--secondary": secondary,
    "--secondary-active": secondaryActive,
    "--secondary-foreground": contrastInk(secondary),
    "--danger": darkBase ? "#f87171" : "#dc2626",
    "--ring": rgba(primary, 0.45),
  };
}

export const THEME_VAR_KEYS = Object.keys(buildThemeVars(DEFAULT_BRAND_COLORS));

export type SiteThemeLike = {
  enabled: boolean;
  primary: string;
  secondary: string;
  backgroundDark: string;
  backgroundLight: string;
};

/** Serialize brand var maps for the FOUC boot script (safe on server). */
export function buildSiteBrandBootPayload(theme: SiteThemeLike) {
  if (!theme.enabled) {
    return { enabled: false as const };
  }
  return {
    enabled: true as const,
    dark: buildThemeVars({
      primary: theme.primary,
      secondary: theme.secondary,
      background: theme.backgroundDark,
    }),
    light: buildThemeVars({
      primary: theme.primary,
      secondary: theme.secondary,
      background: theme.backgroundLight,
    }),
  };
}
