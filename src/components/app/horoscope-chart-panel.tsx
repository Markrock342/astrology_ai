"use client";

import { useMemo, useState } from "react";
import type { ChartJson } from "@/types/chart";
import {
  chartFromMyhoraRows,
  deriveDivisionalChart,
  type DerivedChart,
} from "@/lib/chart-derivations";
import { getPlanetTheme } from "@/lib/chart-theme";
import { TaksaNineGrid } from "./taksa-nine-grid";
import { ThaiChakraChart } from "./thai-chakra-chart";
import { AstrologyGlossary } from "./astrology-glossary";

function baseChart(chart: ChartJson): DerivedChart {
  const fallback = {
    lagna: chart.chart?.lagna ?? chart.meta.lagna ?? "เมษ",
    planets: chart.planets,
  };
  return chartFromMyhoraRows(chart.myhora?.natalPlanets, fallback) ?? fallback;
}

export function EvidenceGrid({
  title,
  cells,
  kind,
}: {
  title: string;
  kind: "taksa" | "triwai";
  cells: Array<
    Array<
      | {
          label?: string;
          planetNum?: number | null;
          house?: string;
          ageRange?: string;
          transitLabel?: string;
          highlighted?: boolean;
          isCenter?: boolean;
        }
      | null
    >
  >;
}) {
  if (!cells.length || !cells.some((row) => row.some(Boolean))) return null;
  const visibleRows = cells.filter((row) => row.some(Boolean));
  const columnCount = Math.max(...visibleRows.map((row) => row.length));
  const lifeStages = ["วัยต้น", "วัยกลาง", "วัยปลาย", "วัยเทียบ"];

  return (
    <div className="min-w-0">
      <p className="mb-2 text-xs font-semibold text-[var(--foreground)]">{title}</p>
      <div
        className="grid overflow-hidden rounded-lg border border-[var(--border)]"
        style={{
          gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
        }}
      >
        {visibleRows.flatMap((row, rowIndex) =>
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
                    {cell.isCenter ? (
                      <span
                        className="flex items-center gap-1 text-sm text-[var(--muted-2)]"
                        aria-label="จุดกึ่งกลางทักษา"
                      >
                        <span aria-hidden>↙</span>
                        <span aria-hidden>↑</span>
                        <span aria-hidden>๙</span>
                      </span>
                    ) : theme ? (
                      <span className="text-sm" style={{ color: theme.color }}>
                        {theme.symbol}
                      </span>
                    ) : null}
                    {cell.ageRange ? (
                      <span className="text-[9px] text-[var(--muted-2)]">
                        {cell.ageRange}
                      </span>
                    ) : null}
                    {cell.transitLabel ? (
                      <span className="text-[9px] leading-tight text-[var(--primary)]/75">
                        {cell.transitLabel}
                      </span>
                    ) : null}
                  </>
                ) : null}
              </div>
            );
          }),
        )}
      </div>
      {kind === "triwai" ? (
        <>
          <div
            className="mt-1 grid text-center text-[9px] text-[var(--muted)]"
            style={{
              gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
            }}
          >
            {lifeStages.slice(0, columnCount).map((stage) => (
              <span key={stage}>{stage}</span>
            ))}
          </div>
          <p className="mt-3 text-center text-[10px] text-[var(--muted)]">
            นับตรีวัยจาก <span className="font-medium text-[var(--primary)]">ตนุเศษ</span>
          </p>
        </>
      ) : null}
    </div>
  );
}

/** Deterministic chart atlas attached to the first answer in a thread. */
export function HoroscopeChartPanel({
  natal,
  transit,
  description = "ตำแหน่งดาวชุดเดียวกับที่ใช้วิเคราะห์คำตอบ",
  presentation = "message",
}: {
  natal: ChartJson;
  transit?: ChartJson | null;
  description?: string;
  presentation?: "message" | "reference" | "compact";
}) {
  const d1 = useMemo(() => baseChart(natal), [natal]);
  const d9 = useMemo(() => deriveDivisionalChart(natal, "navamsa"), [natal]);
  const d3 = useMemo(() => deriveDivisionalChart(natal, "drekkana"), [natal]);
  const transitChart = useMemo(
    () => (transit ? baseChart(transit) : null),
    [transit],
  );
  const triwai = natal.myhora?.triwaiNatal ?? [];
  const [countFromCenter, setCountFromCenter] = useState(true);

  const reference = presentation === "reference";
  const compact = presentation === "compact";
  const d1Size = compact ? 248 : reference ? 520 : 360;
  const extraSize = compact ? 220 : reference ? 340 : 260;

  return (
    <section
      className={
        compact
          ? "min-w-0 overflow-hidden"
          : `${reference ? "" : "mb-4"} overflow-hidden rounded-2xl border border-[var(--primary)]/25 bg-[var(--surface)]`
      }
    >
      {compact ? (
        <p className="sr-only">{description}</p>
      ) : (
        <header className="border-b border-[var(--border)] px-4 py-3">
          <div>
            <h2 className={`${reference ? "text-base" : "text-sm"} font-semibold text-[var(--foreground)]`}>
              ผังดวงชะตา
            </h2>
            <p className="mt-0.5 text-[11px] text-[var(--muted)]">
              {description}
            </p>
            {natal.meta.locationDisplay ? (
              <p className="mt-1 text-[11px] text-[var(--muted-2)]">
                {natal.meta.birthDisplay}
                {natal.meta.birthDisplay ? " · " : ""}
                {natal.meta.locationDisplay}
              </p>
            ) : null}
          </div>
        </header>
      )}

      <div className={compact ? "py-1" : "px-3 py-5"}>
        <div className={`flex flex-col ${compact ? "gap-4" : "gap-6"}`}>
          <ThaiChakraChart
            chart={d1}
            title="ราศีจักร · พื้นดวงเดิม"
            size={d1Size}
            prominent
          />
          {!compact && transitChart ? (
            <ThaiChakraChart
              chart={transitChart}
              title="ราศีจักร · ดาวจร"
              size={reference ? 420 : 320}
              prominent
            />
          ) : null}
        </div>

        {compact ? (
          <div className="mt-4">
            <TaksaNineGrid
              input={natal.input}
              slots={natal.chart?.taksa}
              mode="natal"
            />
          </div>
        ) : (
          <div className="mt-6 grid gap-6 border-t border-[var(--border)] pt-5 sm:grid-cols-2">
            <TaksaNineGrid
              input={natal.input}
              slots={natal.chart?.taksa}
              mode="natal"
            />
            <TaksaNineGrid
              input={natal.input}
              scraped={natal.myhora?.taksa}
              mode="transit"
              countFromCenter={countFromCenter}
              onCountFromCenterChange={setCountFromCenter}
              transitInput={transit?.input}
            />
          </div>
        )}
      </div>

      {compact ? null : <AstrologyGlossary compact={!reference} />}

      <details className={compact ? "mt-2 rounded-xl border border-[var(--border)]" : "border-t border-[var(--border)]"}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-xs font-medium text-[var(--primary)] marker:content-none [&::-webkit-details-marker]:hidden">
          <span>ผังวิเคราะห์เพิ่ม</span>
          <span className="text-[11px] font-normal text-[var(--muted)]">
            นวางศ์ · ตรียางศ์ · ตรีวัย <span aria-hidden>＋</span>
          </span>
        </summary>
        <div className="border-t border-[var(--border)] px-3 py-4">
          {d9 && d3 ? (
            <div className={`grid gap-4 ${compact ? "grid-cols-1" : reference ? "grid-cols-[repeat(auto-fit,minmax(260px,1fr))]" : "grid-cols-[repeat(auto-fit,minmax(190px,1fr))]"}`}>
              <ThaiChakraChart
                chart={d9}
                title="นวางศ์จักร"
                size={extraSize}
              />
              <ThaiChakraChart
                chart={d3}
                title="ตรียางศ์จักร"
                size={extraSize}
              />
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/55 px-4 py-5 text-center">
              <p className="text-sm font-medium text-[var(--foreground)]">
                ยังไม่แสดงนวางศ์และตรียางศ์
              </p>
              <p className="mx-auto mt-1 max-w-lg text-xs leading-5 text-[var(--muted)]">
                ผังสองชุดนี้ต้องใช้องศาและลิปดาของลัคนากับดาวครบทุกดวง
                ระบบจึงไม่ใช้ค่าองศาสมมติมาสร้างผังแทนข้อมูลจริง
              </p>
            </div>
          )}

          {triwai.some((row) => row.some(Boolean)) ? (
            <div className="mt-5 border-t border-[var(--border)] pt-5">
              <EvidenceGrid title="ตรีวัย" cells={triwai} kind="triwai" />
            </div>
          ) : null}
        </div>
      </details>
    </section>
  );
}
