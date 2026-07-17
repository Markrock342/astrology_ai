"use client";

import { useMemo } from "react";
import type { ChartJson } from "@/types/chart";
import {
  chartFromMyhoraRows,
  deriveDivisionalChart,
  type DerivedChart,
} from "@/lib/chart-derivations";
import { getPlanetTheme } from "@/lib/chart-theme";
import { ExpandableRasiWheel } from "./expandable-rasi-wheel";
import { ThaiChakraChart } from "./thai-chakra-chart";

function baseChart(chart: ChartJson): DerivedChart {
  const fallback = {
    lagna: chart.chart?.lagna ?? chart.meta.lagna ?? "เมษ",
    planets: chart.planets,
  };
  return chartFromMyhoraRows(chart.myhora?.natalPlanets, fallback) ?? fallback;
}

function EvidenceGrid({
  title,
  cells,
}: {
  title: string;
  cells: Array<
    Array<
      | {
          label?: string;
          planetNum?: number | null;
          house?: string;
          ageRange?: string;
          highlighted?: boolean;
          isCenter?: boolean;
        }
      | null
    >
  >;
}) {
  if (!cells.length || !cells.some((row) => row.some(Boolean))) return null;

  return (
    <div className="min-w-0">
      <p className="mb-2 text-xs font-semibold text-[var(--foreground)]">{title}</p>
      <div
        className="grid overflow-hidden rounded-lg border border-[var(--border)]"
        style={{
          gridTemplateColumns: `repeat(${Math.max(...cells.map((row) => row.length))}, minmax(0, 1fr))`,
        }}
      >
        {cells.flatMap((row, rowIndex) =>
          row.map((cell, columnIndex) => {
            const planet = cell?.planetNum != null
              ? ["มฤตยู", "อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "ราหู", "เกตุ"][
                  cell.planetNum
                ]
              : null;
            const theme = planet ? getPlanetTheme(planet) : null;
            return (
              <div
                key={`${rowIndex}-${columnIndex}`}
                className={`flex min-h-14 flex-col items-center justify-center border-b border-r border-[var(--border)] px-1 py-1 text-center last:border-r-0 ${
                  cell?.highlighted || cell?.isCenter
                    ? "bg-[var(--primary)]/10"
                    : "bg-[var(--surface-2)]/60"
                }`}
              >
                {cell ? (
                  <>
                    <span className="text-[10px] text-[var(--muted)]">
                      {cell.label || cell.house || "—"}
                    </span>
                    {theme ? (
                      <span className="text-sm" style={{ color: theme.color }}>
                        {theme.symbol}
                      </span>
                    ) : null}
                    {cell.ageRange ? (
                      <span className="text-[9px] text-[var(--muted-2)]">
                        {cell.ageRange}
                      </span>
                    ) : null}
                  </>
                ) : null}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}

/**
 * Deterministic chart atlas attached to the first answer in a thread.
 * MyHora supplies positions; HoraSard owns the rendering and interaction.
 */
export function HoroscopeChartPanel({
  natal,
  transit,
}: {
  natal: ChartJson;
  transit?: ChartJson | null;
}) {
  const d1 = useMemo(() => baseChart(natal), [natal]);
  const d9 = useMemo(() => deriveDivisionalChart(natal, "navamsa"), [natal]);
  const d3 = useMemo(() => deriveDivisionalChart(natal, "drekkana"), [natal]);
  const fromMyhora = natal.meta.calculationSource === "myhora-scrape";
  const taksa = natal.myhora?.taksa ?? [];
  const triwai = natal.myhora?.triwaiNatal ?? [];
  const hasEvidenceGrids =
    taksa.some((row) => row.some(Boolean)) ||
    triwai.some((row) => row.some(Boolean));

  return (
    <section className="mb-4 overflow-hidden rounded-2xl border border-[var(--primary)]/25 bg-[var(--surface)]">
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            ผังดวงชะตา
          </h3>
          <p className="mt-0.5 text-[11px] text-[var(--muted)]">
            ตำแหน่งดาวชุดเดียวกับที่ใช้วิเคราะห์คำตอบ
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-1 text-[10px] ${
            fromMyhora
              ? "bg-[var(--secondary-active)]/12 text-[var(--secondary-active)]"
              : "bg-[var(--surface-2)] text-[var(--muted)]"
          }`}
        >
          {fromMyhora ? "ข้อมูลเทียบ MyHora" : "สูตรสำรอง HoraSard"}
        </span>
      </header>

      <div className="flex flex-wrap items-start justify-center gap-5 px-4 py-5">
        <div className="flex flex-col items-center gap-1">
          <span className="text-[11px] font-medium text-[var(--muted)]">พื้นดวง</span>
          <ExpandableRasiWheel chart={natal} size={176} label="พื้นดวงเดิม" />
        </div>
        {transit ? (
          <div className="flex flex-col items-center gap-1">
            <span className="text-[11px] font-medium text-[var(--muted)]">ดาวจร</span>
            <ExpandableRasiWheel chart={transit} size={176} label="ดวงจร" />
          </div>
        ) : null}
      </div>

      <div className="border-t border-[var(--border)] px-3 py-4">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
          <ThaiChakraChart
            chart={d1}
            title="ราศีจักร"
            centerLabel="รจ."
          />
          <ThaiChakraChart
            chart={d9}
            title="นวางศ์จักร"
            centerLabel="นว."
          />
          <ThaiChakraChart
            chart={d3}
            title="ตรียางศ์จักร"
            centerLabel="ตย."
          />
        </div>
      </div>

      {hasEvidenceGrids ? (
        <details className="border-t border-[var(--border)]">
          <summary className="cursor-pointer list-none px-4 py-3 text-xs font-medium text-[var(--primary)] marker:content-none [&::-webkit-details-marker]:hidden">
            ทักษาและตรีวัย <span aria-hidden>▾</span>
          </summary>
          <div className="grid gap-4 px-4 pb-4 sm:grid-cols-2">
            <EvidenceGrid title="ทักษา" cells={taksa} />
            <EvidenceGrid title="ตรีวัย" cells={triwai} />
          </div>
        </details>
      ) : null}
    </section>
  );
}
