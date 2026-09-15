import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildThemeVars, THEME_VAR_KEYS } from "@/lib/theme-colors";

/*
 * WCAG 2.x contrast guard for the theme tokens.
 *
 * Two sources are checked: the literal values in `src/app/globals.css` (both
 * theme blocks, parsed from the file so a regression in the CSS fails here)
 * and the palette `buildThemeVars` derives when an admin enables a site theme.
 */

type Rgb = { r: number; g: number; b: number };

const AA_TEXT = 4.5;

function hexToRgb(hex: string): Rgb {
  let h = hex.trim().slice(1);
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** oklch(L C h) → sRGB, clamped to gamut. Matches CSS Color 4 matrices. */
function oklchToRgb(L: number, C: number, h: number): Rgb {
  const hr = (h * Math.PI) / 180;
  const a = C * Math.cos(hr);
  const b = C * Math.sin(hr);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;

  const rl = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const gl = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  const gamma = (x: number) => {
    const c = Math.max(0, Math.min(1, x));
    return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  };
  return {
    r: Math.round(gamma(rl) * 255),
    g: Math.round(gamma(gl) * 255),
    b: Math.round(gamma(bl) * 255),
  };
}

function parseColor(value: string): Rgb {
  const v = value.trim();
  if (v.startsWith("#")) return hexToRgb(v);
  const oklch = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/i.exec(v);
  if (oklch) {
    return oklchToRgb(Number(oklch[1]), Number(oklch[2]), Number(oklch[3]));
  }
  throw new Error(`Unsupported color syntax in test: ${value}`);
}

function relativeLuminance({ r, g, b }: Rgb): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: string, b: string): number {
  const la = relativeLuminance(parseColor(a));
  const lb = relativeLuminance(parseColor(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Pull `--token: value;` pairs out of one `{ … }` block of globals.css. */
function parseTokenBlock(css: string, selector: RegExp): Record<string, string> {
  const start = css.search(selector);
  if (start < 0) throw new Error(`Theme block not found: ${selector}`);
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  const body = css.slice(open + 1, close);
  const tokens: Record<string, string> = {};
  for (const match of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    tokens[match[1]!] = match[2]!.replace(/\/\*.*?\*\//g, "").trim();
  }
  return tokens;
}

const css = readFileSync(
  resolve(__dirname, "../src/app/globals.css"),
  "utf8",
);
const darkTokens = parseTokenBlock(css, /:root,\s*\[data-theme="dark"\]/);
const lightTokens = parseTokenBlock(css, /\[data-theme="light"\]\s*\{/);

/** The assertions every palette (CSS or generated) has to satisfy. */
function expectReadablePalette(label: string, t: Record<string, string>) {
  const check = (fg: string, bg: string, min: number) => {
    const ratio = contrast(t[fg]!, t[bg]!);
    expect(
      ratio,
      `${label}: ${fg} (${t[fg]}) on ${bg} (${t[bg]}) = ${ratio.toFixed(2)}`,
    ).toBeGreaterThanOrEqual(min);
  };

  // Running text on the panel it most often sits on.
  check("--foreground", "--surface-2", AA_TEXT);
  check("--muted", "--surface-2", AA_TEXT);
  check("--muted-2", "--surface-2", AA_TEXT);
  // Brand colors are used as text (headings, links, captions).
  check("--primary", "--surface", AA_TEXT);
  check("--secondary", "--surface", AA_TEXT);
  // Danger as text on the page and ink on danger-filled buttons.
  check("--danger", "--background", AA_TEXT);
  check("--danger-foreground", "--danger", AA_TEXT);
  check("--primary-foreground", "--primary", AA_TEXT);

  // muted-2 is the quieter of the two; it must not overtake muted.
  const mutedOnSurface = contrast(t["--muted"]!, t["--surface-2"]!);
  const muted2OnSurface = contrast(t["--muted-2"]!, t["--surface-2"]!);
  expect(muted2OnSurface, `${label}: muted-2 dimmer than muted`).toBeLessThan(
    mutedOnSurface,
  );
}

describe("globals.css theme tokens", () => {
  it("dark theme tokens read as text", () => {
    expectReadablePalette("css dark", darkTokens);
  });

  it("light theme tokens read as text", () => {
    expectReadablePalette("css light", lightTokens);
  });

  it("exposes danger-foreground in both blocks and the @theme map", () => {
    expect(darkTokens["--danger-foreground"]).toBeDefined();
    expect(lightTokens["--danger-foreground"]).toBeDefined();
    expect(css).toContain("--color-danger-foreground: var(--danger-foreground);");
  });

  it("no longer ships the unused .shimmer-text rule but keeps the keyframe", () => {
    expect(css).not.toContain(".shimmer-text");
    expect(css).toContain("@keyframes shimmer");
  });
});

describe("buildThemeVars contrast", () => {
  const brand = { primary: "#c9a24b", secondary: "#1f8f7a" };

  it("default dark background", () => {
    const vars = buildThemeVars({ ...brand, background: "#0d0d0f" });
    expectReadablePalette("generated dark", vars);
    // Brand gold already passes on the dark surface, so it is left untouched.
    expect(vars["--primary"]).toBe("#c9a24b");
  });

  it("default light background darkens the raw gold instead of passing it through", () => {
    const vars = buildThemeVars({ ...brand, background: "#f3f4f6" });
    expectReadablePalette("generated light", vars);
    expect(vars["--primary"]).not.toBe("#c9a24b");
    expect(vars["--accent"]).toBe(vars["--primary"]);
  });

  it("lifts a brand color that is too dark for a dark base", () => {
    const vars = buildThemeVars({
      primary: "#3b1a6e",
      secondary: "#0b3d36",
      background: "#0d0d0f",
    });
    expectReadablePalette("generated dark / dark brand", vars);
  });

  it("holds on off-palette admin backgrounds", () => {
    expectReadablePalette(
      "generated navy",
      buildThemeVars({ ...brand, background: "#1a1033" }),
    );
    expectReadablePalette(
      "generated cream",
      buildThemeVars({ ...brand, background: "#fff8e6" }),
    );
  });

  it("includes --danger-foreground in the keys the brand provider clears", () => {
    expect(THEME_VAR_KEYS).toContain("--danger-foreground");
  });
});
