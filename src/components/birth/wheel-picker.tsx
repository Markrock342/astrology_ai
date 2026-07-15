"use client";

import { useEffect, useRef } from "react";

/**
 * iOS-style drum/wheel picker built on native CSS scroll-snap — momentum
 * scrolling comes free on touch, and it handles far-past years (birthdays)
 * far better than a calendar popup. State stays plain strings so the parent's
 * validation/payload logic is unchanged; a leading "—" placeholder keeps the
 * "not chosen yet" state representable for required-field checks.
 */

export const ITEM_H = 36;
const VISIBLE = 5; // odd, so exactly one row sits at center
const PAD = ((VISIBLE - 1) / 2) * ITEM_H;

export type WheelOption = { value: string; label: string };

export function WheelColumn({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: WheelOption[];
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const settleRef = useRef<number | null>(null);
  // Latest value read by the debounced scroll/keydown handlers without a stale
  // closure. Synced in an effect (never during render — the compiler forbids it).
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const indexOf = (v: string) => {
    const i = options.findIndex((o) => o.value === v);
    return i < 0 ? 0 : i;
  };

  // Snap the drum to the value when it changes from OUTSIDE (era toggle rebases
  // the year, a shorter month clamps the day). Guarded on distance so it never
  // fights an in-progress user scroll or loops with the scroll handler.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = indexOf(value) * ITEM_H;
    if (Math.abs(el.scrollTop - target) > 2) el.scrollTop = target;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, options.length]);

  function handleScroll() {
    const el = ref.current;
    if (!el) return;
    if (settleRef.current) window.clearTimeout(settleRef.current);
    // Read the centered row only after the fling/snap settles.
    settleRef.current = window.setTimeout(() => {
      const idx = Math.max(
        0,
        Math.min(options.length - 1, Math.round(el.scrollTop / ITEM_H)),
      );
      const next = options[idx]?.value ?? "";
      if (next !== valueRef.current) onChange(next);
    }, 90);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    const idx = indexOf(valueRef.current);
    let next = idx;
    if (e.key === "ArrowDown") next = Math.min(options.length - 1, idx + 1);
    else if (e.key === "ArrowUp") next = Math.max(0, idx - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = options.length - 1;
    else return;
    e.preventDefault();
    const v = options[next]?.value ?? "";
    if (v !== valueRef.current) onChange(v);
  }

  return (
    <div
      ref={ref}
      onScroll={handleScroll}
      onKeyDown={handleKeyDown}
      role="listbox"
      aria-label={ariaLabel}
      tabIndex={0}
      className="relative flex-1 overflow-y-scroll outline-none [scrollbar-width:none] focus-visible:ring-1 focus-visible:ring-[var(--primary)]/50 [&::-webkit-scrollbar]:hidden"
      style={{
        height: VISIBLE * ITEM_H,
        scrollSnapType: "y mandatory",
        overscrollBehavior: "contain",
        maskImage:
          "linear-gradient(to bottom, transparent, #000 32%, #000 68%, transparent)",
        WebkitMaskImage:
          "linear-gradient(to bottom, transparent, #000 32%, #000 68%, transparent)",
      }}
    >
      <div style={{ height: PAD }} aria-hidden />
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value || "placeholder"}
            type="button"
            tabIndex={-1}
            role="option"
            aria-selected={selected}
            onClick={() => {
              ref.current?.scrollTo({
                top: indexOf(o.value) * ITEM_H,
                behavior: "smooth",
              });
              if (o.value !== value) onChange(o.value);
            }}
            className={`flex w-full items-center justify-center tabular-nums transition-colors ${
              selected
                ? "font-semibold text-[var(--foreground)]"
                : "text-[var(--muted-2)]"
            }`}
            style={{ height: ITEM_H, scrollSnapAlign: "center" }}
          >
            {o.label}
          </button>
        );
      })}
      <div style={{ height: PAD }} aria-hidden />
    </div>
  );
}

export function WheelGroup({
  headers,
  children,
}: {
  headers?: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]">
      {headers && (
        <div className="flex border-b border-[var(--border)]/60">
          {headers.map((h, i) => (
            <div
              key={`${h}-${i}`}
              className="flex-1 py-1.5 text-center text-[10px] tracking-wide text-[var(--muted-2)]"
            >
              {h}
            </div>
          ))}
        </div>
      )}
      <div className="relative overflow-hidden">
        {/* Center selection band — the row that lines up here is the choice. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-1/2 z-0 -translate-y-1/2 border-y border-[var(--primary)]/40 bg-[var(--primary)]/5"
          style={{ height: ITEM_H }}
        />
        <div className="relative z-10 flex" style={{ height: VISIBLE * ITEM_H }}>
          {children}
        </div>
      </div>
    </div>
  );
}
