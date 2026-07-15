"use client";

import { useMemo } from "react";
import type { ChartJson } from "@/types/chart";
import {
  SIGNS,
  getPlanetTheme,
  getSignTheme,
  houseFromLagna,
  normalizeSignName,
  signIndex,
} from "@/lib/chart-theme";

const SIZE = 420;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R_OUTER = 190;
const R_INNER = 118;
const R_PLANET = 152;

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/**
 * Compact rasi wheel for chat — visual reference only.
 * No captions explaining what it is; planet tooltips on hover.
 */
export function CompactRasiWheel({
  chart,
  className = "",
  size = 140,
}: {
  chart: ChartJson;
  className?: string;
  size?: number;
}) {
  const lagna = chart.chart?.lagna ?? chart.meta.lagna ?? "เมษ";
  const lagnaIdx = signIndex(lagna);

  const segments = useMemo(
    () =>
      SIGNS.map((sign, i) => {
        const rel = (i - lagnaIdx + 12) % 12;
        const startDeg = rel * 30;
        const endDeg = startDeg + 30;
        const midDeg = startDeg + 15;
        return {
          sign,
          startDeg,
          endDeg,
          midDeg,
          house: rel + 1,
          theme: getSignTheme(sign),
        };
      }),
    [lagnaIdx],
  );

  const planetsBySign = useMemo(() => {
    const map = new Map<string, ChartJson["planets"]>();
    for (const row of chart.planets) {
      // Stored rows use myhora's "07 : พจ" code — group under the full name
      // the segments are keyed by, or every planet silently vanishes.
      const sign = normalizeSignName(row.siderealSign);
      const list = map.get(sign) ?? [];
      list.push(row);
      map.set(sign, list);
    }
    return map;
  }, [chart.planets]);

  const planetGlyphs = useMemo(() => {
    const items: Array<{
      key: string;
      midDeg: number;
      idx: number;
      row: ChartJson["planets"][number];
    }> = [];
    for (const { sign, midDeg } of segments) {
      const rows = planetsBySign.get(sign) ?? [];
      rows.forEach((row, idx) => {
        items.push({ key: `${sign}-${row.planet}`, midDeg, idx, row });
      });
    }
    return items;
  }, [segments, planetsBySign]);

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      role="img"
      aria-hidden="true"
    >
      <circle
        cx={CX}
        cy={CY}
        r={R_OUTER}
        fill="none"
        stroke="rgba(201,162,75,0.4)"
        strokeWidth="1.5"
      />
      <circle
        cx={CX}
        cy={CY}
        r={R_INNER}
        fill="rgba(13,13,15,0.75)"
        stroke="rgba(201,162,75,0.2)"
        strokeWidth="1"
      />

      {segments.map(({ sign, startDeg, endDeg, midDeg, house, theme }) => {
        const p1 = polar(CX, CY, R_INNER, startDeg);
        const p2 = polar(CX, CY, R_OUTER, startDeg);
        const p3 = polar(CX, CY, R_OUTER, endDeg);
        const p4 = polar(CX, CY, R_INNER, endDeg);
        const label = polar(CX, CY, (R_OUTER + R_INNER) / 2, midDeg);
        const isLagna = sign === lagna;
        return (
          <g key={sign}>
            <path
              d={`M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} A ${R_OUTER} ${R_OUTER} 0 0 1 ${p3.x} ${p3.y} L ${p4.x} ${p4.y} A ${R_INNER} ${R_INNER} 0 0 0 ${p1.x} ${p1.y} Z`}
              fill={isLagna ? "rgba(201,162,75,0.22)" : theme.bg}
              stroke="rgba(201,162,75,0.18)"
              strokeWidth="0.5"
            />
            <text
              x={label.x}
              y={label.y - 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="var(--foreground)"
              fontSize={isLagna ? 13 : 11}
              fontWeight={isLagna ? 600 : 400}
            >
              {sign}
            </text>
            <text
              x={label.x}
              y={label.y + 12}
              textAnchor="middle"
              fill="var(--muted-2)"
              fontSize="9"
            >
              {house}
            </text>
          </g>
        );
      })}

      <text
        x={CX}
        y={CY - 6}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="var(--primary)"
        fontSize="12"
        fontWeight={500}
      >
        {lagna}
      </text>

      {planetGlyphs.map(({ key, midDeg, idx, row }) => {
        const rowSign = normalizeSignName(row.siderealSign);
        const rows = planetsBySign.get(rowSign) ?? [];
        const degreeOffset = (row.degreeInSign ?? 15) - 15;
        const offset = degreeOffset * 1.2 + (idx - (rows.length - 1) / 2) * 8;
        const pos = polar(CX, CY, R_PLANET + offset, midDeg);
        const theme = getPlanetTheme(row.planet);
        return (
          <g key={key}>
            <circle
              cx={pos.x}
              cy={pos.y}
              r={13}
              fill="rgba(13,13,15,0.92)"
              stroke={theme.color}
              strokeWidth="1.2"
            />
            <text
              x={pos.x}
              y={pos.y + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={theme.color}
              fontSize="13"
            >
              {theme.symbol}
            </text>
            <title>
              {row.planet} · ราศี{rowSign}
              {row.degreeText ? ` · ${row.degreeText}` : ""} · เรือน{" "}
              {houseFromLagna(lagna, row.siderealSign)}
            </title>
          </g>
        );
      })}
    </svg>
  );
}
