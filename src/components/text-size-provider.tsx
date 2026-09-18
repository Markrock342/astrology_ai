"use client";

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
} from "react";

/**
 * Reader-controlled text size. Older readers asked for a way to enlarge the
 * type without changing their whole phone's settings, so this scales the app's
 * root font size — every rem-based size follows it.
 */
export type TextSize = "small" | "medium" | "large";

export const TEXT_SIZE_OPTIONS: { id: TextSize; label: string; scale: number }[] = [
  { id: "small", label: "เล็ก", scale: 1 },
  { id: "medium", label: "กลาง", scale: 1.125 },
  { id: "large", label: "ใหญ่", scale: 1.25 },
];

export const TEXT_SIZE_STORAGE_KEY = "hora-text-size";
const DEFAULT_SIZE: TextSize = "small";

function isTextSize(value: string | null): value is TextSize {
  return value === "small" || value === "medium" || value === "large";
}

export function textSizeScale(size: TextSize): number {
  return TEXT_SIZE_OPTIONS.find((option) => option.id === size)?.scale ?? 1;
}

/** Root font size in px for a given step — 16px is the browser default. */
export function textSizePx(size: TextSize): string {
  return `${(16 * textSizeScale(size)).toFixed(2)}px`;
}

export function applyTextSize(size: TextSize) {
  const root = document.documentElement;
  root.dataset.textSize = size;
  root.style.fontSize = textSizePx(size);
}

const listeners = new Set<() => void>();

function readStored(): TextSize {
  try {
    const stored = window.localStorage.getItem(TEXT_SIZE_STORAGE_KEY);
    return isTextSize(stored) ? stored : DEFAULT_SIZE;
  } catch {
    return DEFAULT_SIZE;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

type TextSizeContextValue = {
  textSize: TextSize;
  setTextSize: (size: TextSize) => void;
};

const TextSizeContext = createContext<TextSizeContextValue | null>(null);

export function TextSizeProvider({ children }: { children: React.ReactNode }) {
  const textSize = useSyncExternalStore(subscribe, readStored, () => DEFAULT_SIZE);

  const setTextSize = useCallback((next: TextSize) => {
    try {
      window.localStorage.setItem(TEXT_SIZE_STORAGE_KEY, next);
    } catch {
      /* private mode — the change still applies for this session */
    }
    applyTextSize(next);
    for (const listener of listeners) listener();
  }, []);

  return (
    <TextSizeContext value={{ textSize, setTextSize }}>
      {children}
    </TextSizeContext>
  );
}

export function useTextSize(): TextSizeContextValue {
  const ctx = useContext(TextSizeContext);
  if (!ctx) throw new Error("useTextSize must be used inside TextSizeProvider");
  return ctx;
}
