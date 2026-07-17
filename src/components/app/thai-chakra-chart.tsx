"use client";

import { useMemo } from "react";
import type { DerivedChart } from "@/lib/chart-derivations";
import {
  getPlanetTheme,
  normalizeSignName,
  SIGNS,
} from "@/lib/chart-theme";

const VIEWBOX = 360;
const CENTER = 180;
const OUTER_R = 164;
const GRID_MIN = 54;
const GRID_MAX = 306;
const CORE_MIN = 126;
const CORE_MAX = 234;

const CELL_POSITIONS = [
  { x: 102, y: 90 },
  { x: 180, y: 88 },
  { x: 258, y: 90 },
  { x: 274, y: 126 },
  { x: 274, y: 180 },
  { x: 274, y: 234 },
  { x: 258, y: 270 },
  { x: 180, y: 272 },
  { x: 102, y: 270 },
  { x: 86, y: 234 },
  { x: 86, y: 180 },
  { x: 86, y: 126 },
] as const;

const SIGN_ABBR = [
  "เมษ",
  "พฤษภ",
  "มิถุน",
  "กรกฎ",
  "สิงห์",
  "กันย์",
  "ตุลย์",
  "พิจิก",
  "ธนู",
  "มกร",
  "กุมภ์",
  "มีน",
];

function polar(radius: number, degree: number) {
  const rad = ((degree - 90) * Math.PI) / 180;
  return {
    x: CENTER + radius * Math.cos(rad),
    y: CENTER + radius * Math.sin(rad),
  };
}

export function ThaiChakraChart({
  chart,
  title,
  centerLabel,
  size = 224,
}: {
  chart: DerivedChart;
  title: string;
  centerLabel: string;
  size?: number;
}) {
  const planetsBySign = useMemo(() => {
    const grouped = new Map<string, DerivedChart["planets"]>();
    for (const planet of chart.planets) {
      const sign = normalizeSignName(planet.siderealSign);
      grouped.set(sign, [...(grouped.get(sign) ?? []), planet]);
    }
    return grouped;
  }, [chart.planets]);

  const lagna = normalizeSignName(chart.lagna);

  return (
    <figure className="min-w-0">
      <figcaption className="mb-2 text-center text-xs font-semibold tracking-wide text-[var(--primary)]">
        {title}
      </figcaption>
      <svg
        viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
        width={size}
        height={size}
        className="h-auto w-full"
        role="img"
        aria-label={`${title} ลัคนาราศี${lagna}`}
      >
        <circle
          cx={CENTER}
          cy={CENTER}
          r={OUTER_R}
          fill="var(--surface-2)"
          fillOpacity="0.86"
          stroke="var(--primary)"
          strokeOpacity="0.5"
          strokeWidth="1.5"
        />
        <circle
          cx={CENTER}
          cy={CENTER}
          r={OUTER_R - 9}
          fill="none"
          stroke="var(--border)"
          strokeWidth="1"
        />

        <g
          fill="none"
          stroke="var(--muted-2)"
          strokeOpacity="0.58"
          strokeWidth="1"
        >
          <rect
            x={GRID_MIN}
            y={GRID_MIN}
            width={GRID_MAX - GRID_MIN}
            height={GRID_MAX - GRID_MIN}
          />
          <rect
            x={CORE_MIN}
            y={CORE_MIN}
            width={CORE_MAX - CORE_MIN}
            height={CORE_MAX - CORE_MIN}
          />
          <line x1={GRID_MIN} y1={GRID_MIN} x2={CORE_MIN} y2={CORE_MIN} />
          <line x1={GRID_MAX} y1={GRID_MIN} x2={CORE_MAX} y2={CORE_MIN} />
          <line x1={GRID_MAX} y1={GRID_MAX} x2={CORE_MAX} y2={CORE_MAX} />
          <line x1={GRID_MIN} y1={GRID_MAX} x2={CORE_MIN} y2={CORE_MAX} />
          <line x1={CENTER} y1={GRID_MIN} x2={CENTER} y2={CORE_MIN} />
          <line x1={CORE_MAX} y1={CENTER} x2={GRID_MAX} y2={CENTER} />
          <line x1={CENTER} y1={CORE_MAX} x2={CENTER} y2={GRID_MAX} />
          <line x1={GRID_MIN} y1={CENTER} x2={CORE_MIN} y2={CENTER} />
        </g>

        {SIGNS.map((sign, index) => {
          const angle = index * 30;
          const label = polar(177, angle);
          return (
            <text
              key={sign}
              x={label.x}
              y={label.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="var(--muted)"
              fontSize="8.5"
            >
              {SIGN_ABBR[index]}
            </text>
          );
        })}

        {SIGNS.map((sign, index) => {
          const position = CELL_POSITIONS[index];
          const planets = planetsBySign.get(sign) ?? [];
          const isLagna = sign === lagna;
          const labels = [
            ...(isLagna ? [{ planet: "ลัคนา", symbol: "ลั", color: "var(--primary)" }] : []),
            ...planets.map((planet) => ({
              planet: planet.planet,
              symbol: getPlanetTheme(planet.planet).symbol,
              color: getPlanetTheme(planet.planet).color,
            })),
          ];
          const columns = labels.length > 3 ? 3 : Math.max(1, labels.length);

          return (
            <g key={sign}>
              {isLagna ? (
                <circle
                  cx={position.x}
                  cy={position.y}
                  r="24"
                  fill="var(--primary)"
                  fillOpacity="0.08"
                  stroke="var(--primary)"
                  strokeOpacity="0.32"
                />
              ) : null}
              {labels.map((item, itemIndex) => {
                const col = itemIndex % columns;
                const row = Math.floor(itemIndex / columns);
                const x = position.x + (col - (columns - 1) / 2) * 16;
                const y = position.y + (row - (labels.length > 3 ? 0.5 : 0)) * 17;
                return (
                  <text
                    key={`${sign}-${item.planet}`}
                    x={x}
                    y={y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={item.color}
                    fontSize={item.planet === "ลัคนา" ? "11" : "14"}
                    fontWeight={item.planet === "ลัคนา" ? "600" : "400"}
                  >
                    {item.symbol}
                    <title>
                      {item.planet} · ราศี{sign}
                    </title>
                  </text>
                );
              })}
            </g>
          );
        })}

        <text
          x={CENTER}
          y={CENTER - 5}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="var(--primary)"
          fontSize="13"
          fontWeight="600"
        >
          {centerLabel}
        </text>
        <text
          x={CENTER}
          y={CENTER + 13}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="var(--foreground)"
          fontSize="10"
        >
          ลัคนา {lagna}
        </text>
      </svg>
    </figure>
  );
}
