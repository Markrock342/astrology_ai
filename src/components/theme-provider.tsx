"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useSyncExternalStore,
} from "react";

export type Theme = "dark" | "light";

export const THEME_OPTIONS: { id: Theme; label: string }[] = [
  { id: "dark", label: "มืด" },
  { id: "light", label: "สว่าง" },
];

const STORAGE_KEY = "hora-theme";

type ThemeOrigin = { x: number; y: number };

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme, origin?: ThemeOrigin) => void;
  toggleTheme: (origin?: ThemeOrigin) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark";
}

function applyThemeAttr(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme;
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function setThemeRevealOrigin(origin?: ThemeOrigin) {
  const root = document.documentElement;
  if (!origin) {
    root.removeAttribute("data-theme-origin");
    root.style.removeProperty("--theme-x");
    root.style.removeProperty("--theme-y");
    root.style.removeProperty("--theme-r");
    return;
  }
  const radius = Math.hypot(
    Math.max(origin.x, window.innerWidth - origin.x),
    Math.max(origin.y, window.innerHeight - origin.y),
  );
  root.style.setProperty("--theme-x", `${origin.x}px`);
  root.style.setProperty("--theme-y", `${origin.y}px`);
  root.style.setProperty("--theme-r", `${Math.ceil(radius)}px`);
  root.setAttribute("data-theme-origin", "1");
}

function startThemeViewTransition(apply: () => void, origin?: ThemeOrigin) {
  const doc = document as Document & {
    startViewTransition?: (update: () => void) => { finished: Promise<void> };
  };
  if (!doc.startViewTransition || prefersReducedMotion()) {
    apply();
    return;
  }
  setThemeRevealOrigin(origin);
  const transition = doc.startViewTransition(apply);
  void transition.finished.finally(() => setThemeRevealOrigin());
}

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isTheme(stored)) return stored;
    // Migrate away from removed "custom" local mode.
    if (stored === "custom") return "dark";
  } catch {
    /* ignore */
  }
  return "dark";
}

const listeners = new Set<() => void>();

function subscribeTheme(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

function emitThemeChange() {
  for (const listener of listeners) listener();
}

function getThemeSnapshot(): Theme {
  return readStoredTheme();
}

function getServerThemeSnapshot(): Theme {
  return "dark";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );

  useLayoutEffect(() => {
    applyThemeAttr(theme);
  }, [theme]);

  const setTheme = useCallback((next: Theme, origin?: ThemeOrigin) => {
    startThemeViewTransition(() => {
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      applyThemeAttr(next);
      emitThemeChange();
    }, origin);
  }, []);

  const toggleTheme = useCallback(
    (origin?: ThemeOrigin) => {
      setTheme(theme === "dark" ? "light" : "dark", origin);
    },
    [setTheme, theme],
  );

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
