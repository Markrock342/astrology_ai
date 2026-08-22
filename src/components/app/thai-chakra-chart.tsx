"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { DerivedChart } from "@/lib/chart-derivations";
import { normalizeSignName } from "@/lib/chart-theme";
import { RasiTemplateChart } from "./rasi-template-chart";

type ThaiChakraChartProps = {
  chart: DerivedChart;
  title: string;
  size?: number;
  prominent?: boolean;
};

function ThaiChakraFigure({
  chart,
  title,
  size = 320,
}: ThaiChakraChartProps) {
  const lagna = normalizeSignName(chart.lagna);

  return (
    <div className="flex min-w-0 flex-col items-center gap-2">
      <p className="text-center text-xs font-semibold tracking-wide text-[var(--primary)]">
        {title}
        <span className="ml-2 font-normal text-[var(--muted)]">ลัคนา {lagna}</span>
      </p>
      <RasiTemplateChart chart={chart} size={size} className="w-full" />
    </div>
  );
}

/** ราศีจักรตามไฟล์ Horasard Template — กดเพื่อเปิดภาพขนาดอ่านง่าย */
export function ThaiChakraChart(props: ThaiChakraChartProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const trigger = triggerRef.current;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`press-scale block w-full rounded-xl bg-[#0d0d0f] p-2 outline-none ring-[var(--primary)] transition focus-visible:ring-2 ${
          props.prominent ? "mx-auto max-w-xl" : ""
        }`}
        onClick={() => setOpen(true)}
        aria-label={`ขยาย${props.title}`}
        title={`ขยาย${props.title}`}
      >
        <ThaiChakraFigure {...props} />
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[130] flex items-center justify-center bg-black/85 p-3"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setOpen(false);
              }}
            >
              <div className="animate-fade-up flex max-h-[96vh] w-full max-w-2xl flex-col rounded-2xl border border-[var(--border)] bg-[#111113] p-4">
                <div className="flex items-center justify-between gap-4">
                  <h2
                    id={titleId}
                    className="text-base font-semibold text-[var(--foreground)]"
                  >
                    {props.title}
                  </h2>
                  <button
                    ref={closeButtonRef}
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex size-11 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-lg text-[var(--muted)] transition hover:bg-[var(--surface-3)] hover:text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                    aria-label="ปิด"
                  >
                    ✕
                  </button>
                </div>
                <div className="min-h-0 overflow-auto py-2">
                  <ThaiChakraFigure
                    {...props}
                    size={Math.min(
                      620,
                      typeof window !== "undefined" ? window.innerWidth - 48 : 520,
                    )}
                  />
                </div>
                <p className="text-center text-[11px] text-[var(--muted-2)]">
                  เมษอยู่บนสุดตามแบบราศีจักร · อักษร ล คือลัคนา · กด Esc เพื่อปิด
                </p>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
