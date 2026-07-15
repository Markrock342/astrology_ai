"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { CompactRasiWheel } from "./compact-rasi-wheel";
import type { ChartJson } from "@/types/chart";

/**
 * Compact wheel that opens a large lightbox on click/tap.
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
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="press-scale group relative rounded-full outline-none ring-[var(--primary)] transition focus-visible:ring-2"
        aria-label={label ? `ขยาย${label}` : "ขยายแผนภูมิราศี"}
        title="แตะเพื่อขยาย"
      >
        <CompactRasiWheel chart={chart} size={size} />
        <span className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b-full bg-black/55 py-0.5 text-center text-[9px] text-[var(--primary)] opacity-90 group-hover:opacity-100">
          ขยาย
        </span>
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
              <div className="animate-fade-up relative flex max-h-[95vh] w-full max-w-lg flex-col items-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xl">
                <div className="mb-2 flex w-full items-center justify-between">
                  <h2 id={titleId} className="text-sm font-semibold text-[var(--foreground)]">
                    {label ?? "แผนภูมิราศี"}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-md px-2 py-1 text-sm text-[var(--muted)] hover:bg-[var(--surface-3)] hover:text-[var(--foreground)]"
                    aria-label="ปิด"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex max-h-[min(80vh,520px)] w-full items-center justify-center overflow-auto py-2">
                  <CompactRasiWheel chart={chart} size={Math.min(420, typeof window !== "undefined" ? window.innerWidth - 64 : 360)} />
                </div>
                <p className="mt-1 max-w-sm text-center text-[11px] leading-relaxed text-[var(--muted)]">
                  วงล้อราศีจักรจากวันเวลาเกิดของคุณ — ช่องสีทองคือลัคนา
                  (จุดเริ่มเรือนที่ 1) ตัวเลขคือเรือนชะตา 1–12
                  และสัญลักษณ์คือดาวที่สถิตในแต่ละราศี (ชี้ที่ดาวเพื่อดูรายละเอียด)
                </p>
                <p className="mt-2 text-center text-[11px] text-[var(--muted-2)]">
                  แตะพื้นหลังหรือกด Esc เพื่อปิด
                </p>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
