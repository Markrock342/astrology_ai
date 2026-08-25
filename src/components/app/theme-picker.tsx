"use client";

import { useRef } from "react";
import { THEME_OPTIONS, useTheme, type Theme } from "@/components/theme-provider";
import { MoonIcon, SunIcon } from "./sidebar-icons";

function ThemeGlyph({ theme, size = 18 }: { theme: Theme; size?: number }) {
  return theme === "light" ? <SunIcon size={size} /> : <MoonIcon size={size} />;
}

export function ThemePicker() {
  const { theme, toggleTheme } = useTheme();
  const hasToggled = useRef(false);
  const next = theme === "dark" ? "light" : "dark";
  const nextLabel =
    THEME_OPTIONS.find((option) => option.id === next)?.label ?? next;

  return (
    <button
      type="button"
      onClick={(event) => {
        hasToggled.current = true;
        toggleTheme({ x: event.clientX, y: event.clientY });
      }}
      className="theme-toggle press-scale rounded-full p-2 text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--primary)]"
      aria-label={`เปลี่ยนเป็นโหมด${nextLabel}`}
      title={`เปลี่ยนเป็นโหมด${nextLabel}`}
    >
      <span
        className={hasToggled.current ? "theme-toggle-glyph" : "inline-flex"}
        data-to={next}
        key={next}
      >
        <ThemeGlyph theme={next} />
      </span>
    </button>
  );
}

/** Explicit settings control — unlike the icon shortcut, both choices are visible. */
export function ThemeSettingsControl() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="ธีมหน้าจอ"
      className="grid grid-cols-2 gap-1 rounded-xl bg-[var(--background)] p-1"
    >
      {THEME_OPTIONS.map((option) => {
        const active = option.id === theme;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={(event) =>
              setTheme(option.id, { x: event.clientX, y: event.clientY })
            }
            className={`flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition ${
              active
                ? "bg-[var(--surface-3)] text-[var(--primary)] shadow-[inset_0_0_0_1px_var(--border)]"
                : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
            }`}
          >
            <ThemeGlyph theme={option.id} size={17} />
            {option.id === "light" ? "สว่าง" : "มืด"}
          </button>
        );
      })}
    </div>
  );
}
