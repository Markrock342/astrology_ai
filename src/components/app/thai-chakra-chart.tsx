"use client";

import { memo, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { DerivedChart } from "@/lib/chart-derivations";
import {
  bhavaNameFromLagna,
  getPlanetMeaning,
  getPlanetTheme,
  normalizeSignName,
  PLANET_ORDER,
} from "@/lib/chart-theme";
import { RasiTemplateChart } from "./rasi-template-chart";
import { useDialogFocus } from "./use-dialog-focus";

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
  onSelectPlanet,
  selectedPlanet,
}: ThaiChakraChartProps & {
  onSelectPlanet?: (planet: string) => void;
  selectedPlanet?: string | null;
}) {
  const lagna = normalizeSignName(chart.lagna);

  return (
    <div className="flex min-w-0 flex-col items-center gap-2">
      <p className="text-center text-xs font-semibold tracking-wide text-[var(--primary)]">
        {title}
        <span className="ml-2 font-normal text-[var(--muted)]">ลัคนา {lagna}</span>
      </p>
      <RasiTemplateChart
        chart={chart}
        size={size}
        className="w-full"
        onSelectPlanet={onSelectPlanet}
        selectedPlanet={selectedPlanet}
      />
    </div>
  );
}

/**
 * Every planet on the chart, spelled out under the big wheel: numeral, name,
 * sign, bhava and meaning — all visible at once, no tapping required. Tapping
 * a row still highlights that planet on the wheel (and vice versa).
 */
function PlanetLegend({
  chart,
  selected,
  onSelect,
}: {
  chart: DerivedChart;
  selected: string | null;
  onSelect: (planet: string) => void;
}) {
  const lagna = normalizeSignName(chart.lagna);
  const ordered = [...chart.planets].sort(
    (a, b) =>
      PLANET_ORDER.indexOf(a.planet as (typeof PLANET_ORDER)[number]) -
      PLANET_ORDER.indexOf(b.planet as (typeof PLANET_ORDER)[number]),
  );
  return (
    <ul
      className="mt-3 grid gap-1.5 text-left sm:grid-cols-2"
      aria-label="ความหมายดาวแต่ละดวงในดวงนี้"
    >
      {ordered.map((row) => {
        const theme = getPlanetTheme(row.planet);
        const sign = normalizeSignName(row.siderealSign);
        const active = selected === row.planet;
        return (
          <li key={row.planet}>
            <button
              type="button"
              onClick={() => onSelect(row.planet)}
              aria-pressed={active}
              className={`press-scale flex w-full items-start gap-3 rounded-2xl border px-3.5 py-2.5 text-left transition ${
                active
                  ? "border-[var(--primary)] bg-[var(--primary)]/12"
                  : "border-[var(--border)] hover:border-[var(--primary)]/50"
              }`}
            >
              <span
                className="mt-0.5 w-5 shrink-0 text-center text-lg font-semibold leading-none"
                style={{ color: theme.color }}
                aria-hidden
              >
                {theme.numeral}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[var(--foreground)]">
                  {row.planet}
                  <span className="ml-1.5 font-normal text-[var(--muted)]">
                    ราศี{sign} · ภพ{bhavaNameFromLagna(lagna, sign)}
                  </span>
                </span>
                <span className="block text-xs leading-5 text-[var(--muted)]">
                  {getPlanetMeaning(row.planet)}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** ราศีจักรตามไฟล์ Horasard Template — กดเพื่อเปิดภาพขนาดอ่านง่าย */
export const ThaiChakraChart = memo(function ThaiChakraChart(
  props: ThaiChakraChartProps,
) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useDialogFocus({
    open,
    dialogRef: panelRef,
    onClose: () => setOpen(false),
    initialFocusRef: closeButtonRef,
  });

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`press-scale block w-full rounded-2xl bg-[#0d0d0f] p-2 outline-none ring-[var(--primary)] transition focus-visible:ring-2 ${
          props.prominent ? "mx-auto max-w-xl" : ""
        }`}
        onClick={() => {
          setSelected(null);
          setOpen(true);
        }}
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
              <div
                ref={panelRef}
                tabIndex={-1}
                className="animate-fade-up flex max-h-[96dvh] w-full max-w-2xl flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 outline-none"
              >
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
                    onSelectPlanet={(planet) =>
                      setSelected((current) => (current === planet ? null : planet))
                    }
                    selectedPlanet={selected}
                  />
                  <PlanetLegend
                    chart={props.chart}
                    selected={selected}
                    onSelect={(planet) =>
                      setSelected((current) => (current === planet ? null : planet))
                    }
                  />
                </div>
                <p className="text-center text-[11px] text-[var(--muted-2)]">
                  แตะเลขไทยบนวงล้อหรือรายการด้านล่างเพื่อไฮไลต์ดาวดวงนั้น · อักษร ล คือลัคนา · กด Esc เพื่อปิด
                </p>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
});
