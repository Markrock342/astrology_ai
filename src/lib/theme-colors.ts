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

function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(hexToRgb(a));
  const lb = relativeLuminance(hexToRgb(b));
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Pick dark or light ink for text/icons on `hex` fill. The tinted inks are
 * preferred; when neither clears 4.5:1 (mid-tone fills such as a gold that was
 * darkened to read on a light surface) fall back to pure black/white, which
 * buys the extra tenth or two the tint gives away.
 */
function contrastInk(hex: string): string {
  const dark = "#1a1508";
  const light = "#f5f5f7";
  const preferDark = contrastRatio(hex, dark) >= contrastRatio(hex, light);
  const tinted = preferDark ? dark : light;
  if (contrastRatio(hex, tinted) >= TEXT_CONTRAST) return tinted;
  return preferDark ? "#000000" : "#ffffff";
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

/** WCAG AA for body text — the bar every text token has to clear. */
const TEXT_CONTRAST = 4.5;
const FIT_STEP = 0.06;
const FIT_MAX_ITERATIONS = 40;

/**
 * Nudge a brand color toward black (light base) or white (dark base) until it
 * reads as text on `surface`. Mixing with black/white keeps the hue; the loop
 * stops as soon as the ratio clears the bar so the color stays as close to the
 * admin's pick as possible. Colors that already pass are returned untouched.
 */
function fitToSurface(hex: string, surface: string, darkBase: boolean): string {
  let color = hex;
  for (
    let i = 0;
    i < FIT_MAX_ITERATIONS && contrastRatio(color, surface) < TEXT_CONTRAST;
    i++
  ) {
    color = darkBase ? lighten(color, FIT_STEP) : darken(color, FIT_STEP);
  }
  return color;
}

/**
 * Mix `ink` toward `bg` by `start`, then pull it back toward the ink in small
 * steps until it clears `minRatio` on `surface`. Lets muted tokens stay as
 * quiet as possible while still reading as text on any admin background.
 */
function fitMutedMix(
  ink: { r: number; g: number; b: number },
  bg: { r: number; g: number; b: number },
  surface: { r: number; g: number; b: number },
  start: number,
  minRatio: number,
) {
  let t = start;
  let color = mix(ink, bg, t);
  for (
    let i = 0;
    i < FIT_MAX_ITERATIONS && t > 0 && contrastRatioRgb(color, surface) < minRatio;
    i++
  ) {
    t = Math.max(0, t - 0.02);
    color = mix(ink, bg, t);
  }
  return color;
}

function contrastRatioRgb(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Build CSS custom-property map from brand picks. */
export function buildThemeVars(colors: BrandColors): Record<string, string> {
  const rawPrimary = normalizeHex(colors.primary, DEFAULT_BRAND_COLORS.primary);
  const rawSecondary = normalizeHex(
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
  // Starting mixes; fitMutedMix pulls them back toward the ink only when the
  // resulting gray would not read on surface-2 (the panel most text sits on).
  // Muted clears a higher bar than muted-2 so the two stay visibly distinct.
  const muteMix = darkBase ? 0.42 : 0.32;
  const mute2Mix = darkBase ? 0.58 : 0.4;

  const white = { r: 255, g: 255, b: 255 };
  const surface = darkBase ? mix(bg, ink, 0.06) : mix(bg, white, 0.72);
  const surface2 = mix(bg, ink, darkBase ? 0.12 : 0.05);
  const surface3 = mix(bg, ink, darkBase ? 0.18 : 0.1);
  const border = mix(bg, ink, darkBase ? 0.22 : 0.18);
  const borderStrong = mix(bg, ink, darkBase ? 0.32 : 0.32);
  const muted = fitMutedMix(ink, bg, surface2, muteMix, 5.2);
  const muted2 = fitMutedMix(ink, bg, surface2, mute2Mix, TEXT_CONTRAST);

  // Brand colors are used as text (headings, links, captions), so they must
  // read on the raised surface. Gold #c9a24b is 2.3:1 on a light surface raw.
  const surfaceHex = rgbToHex(surface.r, surface.g, surface.b);
  const primary = fitToSurface(rawPrimary, surfaceHex, darkBase);
  const secondary = fitToSurface(rawSecondary, surfaceHex, darkBase);

  const primaryHover = darkBase ? lighten(primary, 0.12) : darken(primary, 0.1);
  const secondaryActive = darkBase
    ? lighten(secondary, 0.14)
    : darken(secondary, 0.08);

  return {
    "--background": background,
    "--surface": surfaceHex,
    "--surface-2": rgbToHex(surface2.r, surface2.g, surface2.b),
    "--surface-3": rgbToHex(surface3.r, surface3.g, surface3.b),
    "--border": rgbToHex(border.r, border.g, border.b),
    "--border-strong": rgbToHex(
      borderStrong.r,
      borderStrong.g,
      borderStrong.b,
    ),
    "--shadow-color": darkBase
      ? "rgba(4, 4, 7, 0.46)"
      : "rgba(35, 45, 58, 0.18)",
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
    // Mirrors globals.css: the ink on danger fills must clear 4.5:1 on danger.
    "--danger": darkBase ? "#f87171" : "#c81e1e",
    "--danger-foreground": darkBase ? "#2a0a0a" : "#fff5f5",
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
