"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CompactRasiWheel } from "./compact-rasi-wheel";
import {
  getPlanetMeaning,
  getPlanetTheme,
  bhavaNameFromLagna,
  houseFromLagna,
  normalizeSignName,
  PLANET_ORDER,
  toThaiNumeral,
} from "@/lib/chart-theme";
import type { ChartJson } from "@/types/chart";

/**
 * Compact wheel that opens a large lightbox on click/tap. Inside the lightbox
 * every planet is tappable (touch-friendly) and reveals what it means and where
 * it sits — the old hover-only `<title>` did nothing on a phone.
 */
export function ExpandableRasiWheel({
  chart,
  size = 132,
  label,
}: {
  chart: ChartJson;
  size?: number;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const titleId = useId();

  const lagna = chart.chart?.lagna ?? chart.meta.lagna ?? "เมษ";
  const planets = useMemo(
    () =>
      [...chart.planets]
        .sort(
          (a, b) =>
            PLANET_ORDER.indexOf(a.planet as (typeof PLANET_ORDER)[number]) -
            PLANET_ORDER.indexOf(b.planet as (typeof PLANET_ORDER)[number]),
        )
        .map((row) => ({
          planet: row.planet,
          sign: normalizeSignName(row.siderealSign),
          house: houseFromLagna(lagna, row.siderealSign),
          bhavaName: bhavaNameFromLagna(lagna, row.siderealSign),
          degreeText: row.degreeText ?? null,
          theme: getPlanetTheme(row.planet),
          meaning: getPlanetMeaning(row.planet),
        })),
    [chart.planets, lagna],
  );
  const selectedRow = planets.find((p) => p.planet === selected) ?? null;

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    // Capture the trigger now; the cleanup restores focus to it on close.
    const trigger = triggerRef.current;
    // Move focus into the dialog, and hand it back to the trigger on close so
    // keyboard/AT users aren't dropped onto <body> behind the overlay.
    const focusables = () =>
      panel
        ? Array.from(
            panel.querySelectorAll<HTMLElement>(
              'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
            ),
          ).filter((el) => !el.hasAttribute("disabled"))
        : [];
    focusables()[0]?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      // Trap Tab within the panel.
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !panel?.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      trigger?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setSelected(null); // fresh each time the lightbox opens
          setOpen(true);
        }}
        className="press-scale group relative rounded-full outline-none ring-[var(--primary)] transition focus-visible:ring-2"
        aria-label={label ? `ขยาย${label}` : "ขยายแผนภูมิราศี"}
        title="แตะเพื่อขยาย"
      >
        <CompactRasiWheel chart={chart} size={size} />
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setOpen(false);
              }}
            >
              <div
                ref={panelRef}
                className="animate-fade-up relative flex max-h-[95vh] w-full max-w-lg flex-col items-center rounded-2xl border border-[var(--border)] bg-[#121214] p-4 shadow-2xl"
              >
                <div className="mb-2 flex w-full items-center justify-between">
                  <h2 id={titleId} className="text-sm font-semibold text-[var(--foreground)]">
                    {label ?? "พื้นดวงเดิม"}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] text-sm text-[var(--muted)] hover:bg-[var(--surface-3)] hover:text-[var(--foreground)]"
                    aria-label="ปิด"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex w-full items-center justify-center overflow-auto py-1">
                  <CompactRasiWheel
                    chart={chart}
                    size={Math.min(360, typeof window !== "undefined" ? window.innerWidth - 72 : 320)}
                    onSelectPlanet={(p) =>
                      setSelected((cur) => (cur === p ? null : p))
                    }
                    selectedPlanet={selected}
                  />
                </div>

                {/* Detail of the tapped planet — the touch-friendly replacement
                    for the hover tooltip that did nothing on a phone. */}
                {selectedRow ? (
                  <div className="mt-1 w-full rounded-xl border border-[var(--primary)]/30 bg-[var(--primary)]/8 px-3.5 py-2.5">
                    <p className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                      <span style={{ color: selectedRow.theme.color }}>
                        {selectedRow.theme.numeral}
                      </span>
                      {selectedRow.planet}
                      <span className="text-[11px] font-normal text-[var(--muted)]">
                        ราศี{selectedRow.sign} · ภพ{selectedRow.bhavaName}
                        {/* Keep the numeric house number for power-users / legacy copy */}
                        <span className="sr-only"> (เรือน {toThaiNumeral(selectedRow.house)})</span>
                        {selectedRow.degreeText ? ` · ${selectedRow.degreeText}` : ""}
                      </span>
                    </p>
                    <p className="mt-1 text-[13px] leading-relaxed text-[var(--muted)]">
                      {selectedRow.planet}แทน{selectedRow.meaning}
                    </p>
                  </div>
                ) : (
                  <p className="mt-1 max-w-sm text-center text-[11px] leading-relaxed text-[var(--muted)]">
                    อักษร ล สีทองคือลัคนา (จุดเริ่มต้นภพที่ 1) ชื่อภพแสดงในวงชั้นใน —
                    แตะที่ดาวเพื่อดูความหมายและตำแหน่ง
                  </p>
                )}

                {/* Tappable planet legend — always reachable, no aiming at a
                    tiny glyph required. */}
                <div className="mt-2.5 flex w-full flex-wrap justify-center gap-1.5">
                  {planets.map((p) => {
                    const active = p.planet === selected;
                    return (
                      <button
                        key={p.planet}
                        type="button"
                        onClick={() =>
                          setSelected((cur) => (cur === p.planet ? null : p.planet))
                        }
                        className={`press-scale inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition ${
                          active
                            ? "border-[var(--primary)] bg-[var(--primary)]/15 text-[var(--foreground)]"
                            : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--primary)]/50"
                        }`}
                      >
                        <span style={{ color: p.theme.color }}>{p.theme.numeral}</span>
                        {p.planet}
                      </button>
                    );
                  })}
                </div>

                <p className="mt-2.5 text-center text-[11px] text-[var(--muted-2)]">
                  แตะที่วงล้อหรือกด ESC เพื่อปิด
                </p>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
