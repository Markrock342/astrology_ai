"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  THEME_OPTIONS,
  useTheme,
  type Theme,
} from "@/components/theme-provider";
import { MoonIcon, SunIcon } from "./sidebar-icons";

function ThemeGlyph({ theme, size = 18 }: { theme: Theme; size?: number }) {
  return theme === "light" ? <SunIcon size={size} /> : <MoonIcon size={size} />;
}

export function ThemePicker({
  align = "end",
}: {
  align?: "start" | "end" | "center";
}) {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const current = THEME_OPTIONS.find((o) => o.id === theme) ?? THEME_OPTIONS[0]!;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const alignClass =
    align === "start"
      ? "left-0"
      : align === "center"
        ? "left-1/2 -translate-x-1/2"
        : "right-0";

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-full p-2 text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--primary)]"
        aria-label={`ธีม: ${current.label}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        title={`ธีม: ${current.label}`}
      >
        <ThemeGlyph theme={theme} />
      </button>
      {open && (
        <div
          id={menuId}
          role="listbox"
          aria-label="เลือกโหมดสว่าง/มืด"
          className={`absolute bottom-full z-50 mb-1 min-w-[7.5rem] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-2)] py-1 shadow-xl ${alignClass}`}
        >
          {THEME_OPTIONS.map((opt) => {
            const active = opt.id === theme;
            return (
              <button
                key={opt.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  setTheme(opt.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition ${
                  active
                    ? "bg-[var(--surface-3)] font-medium text-[var(--primary)]"
                    : "text-[var(--muted)] hover:bg-[var(--surface-3)] hover:text-[var(--foreground)]"
                }`}
              >
                <span className="text-[var(--primary)]">
                  <ThemeGlyph theme={opt.id} size={15} />
                </span>
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
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
            onClick={() => setTheme(option.id)}
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
