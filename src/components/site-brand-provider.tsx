"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { useTheme } from "@/components/theme-provider";
import { CMS_KEYS, type CmsSiteTheme } from "@/lib/cms-keys";
import {
  THEME_VAR_KEYS,
  buildThemeVars,
} from "@/lib/theme-colors";

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

/** Applies admin-published brand colors site-wide for every visitor. */
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

  return children;
}
