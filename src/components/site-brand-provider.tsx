"use client";

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { useTheme } from "@/components/theme-provider";
import { CMS_KEYS, type CmsSiteTheme } from "@/lib/cms-keys";
import {
  THEME_VAR_KEYS,
  buildThemeVars,
} from "@/lib/theme-colors";
import {
  DEFAULT_BRAND_MARK,
  DEFAULT_BRAND_WORDMARK,
  resolveBrandUrls,
} from "@/lib/brand-assets";

export { resolveBrandUrls } from "@/lib/brand-assets";

function applyThemeVars(vars: Record<string, string>) {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
}

function clearThemeVars() {
  const root = document.documentElement;
  for (const key of THEME_VAR_KEYS) {
    root.style.removeProperty(key);
  }
}

function varsForMode(theme: CmsSiteTheme, mode: "dark" | "light") {
  if (!theme.enabled) return null;
  return buildThemeVars({
    primary: theme.primary,
    secondary: theme.secondary,
    background:
      mode === "dark" ? theme.backgroundDark : theme.backgroundLight,
  });
}

export type SiteBrandAssets = {
  markUrl: string;
  wordmarkUrl: string;
  theme: CmsSiteTheme;
};

const SiteBrandContext = createContext<SiteBrandAssets>({
  markUrl: DEFAULT_BRAND_MARK,
  wordmarkUrl: DEFAULT_BRAND_WORDMARK,
  theme: {
    enabled: false,
    primary: "#c9a24b",
    secondary: "#1f8f7a",
    backgroundDark: "#0d0d0f",
    backgroundLight: "#f3f4f6",
    markUrl: null,
    wordmarkUrl: null,
  },
});

/** Applies admin-published brand colors + exposes logo URLs site-wide. */
export function SiteBrandProvider({
  initialTheme,
  children,
}: {
  initialTheme: CmsSiteTheme;
  children: React.ReactNode;
}) {
  const { theme: mode } = useTheme();
  const [siteTheme, setSiteTheme] = useState(initialTheme);

  useEffect(() => {
    let alive = true;
    async function refresh() {
      try {
        const res = await fetch("/api/settings/public", { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as {
          ok?: boolean;
          data?: Record<string, unknown>;
        } | null;
        const next = json?.data?.[CMS_KEYS.siteTheme] as CmsSiteTheme | undefined;
        if (alive && next && typeof next.enabled === "boolean") {
          setSiteTheme(next);
        }
      } catch {
        /* keep initial */
      }
    }
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  useLayoutEffect(() => {
    const vars = varsForMode(siteTheme, mode);
    if (vars) applyThemeVars(vars);
    else clearThemeVars();
  }, [siteTheme, mode]);

  const value = useMemo<SiteBrandAssets>(() => {
    const urls = resolveBrandUrls(siteTheme);
    return { ...urls, theme: siteTheme };
  }, [siteTheme]);

  return (
    <SiteBrandContext.Provider value={value}>{children}</SiteBrandContext.Provider>
  );
}

/** Brand mark / wordmark URLs from CMS (with static fallbacks). */
export function useSiteBrand(): SiteBrandAssets {
  return useContext(SiteBrandContext);
}
