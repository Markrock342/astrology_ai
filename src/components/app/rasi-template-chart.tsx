import type { PlanetSignRow } from "@/types/chart";
import { clampDegreeInSign, signWheelAngle } from "@/lib/chart-aspects";
import {
  bhavaNameFromLagna,
  getHouseMeaning,
  getPlanetTheme,
  LAGNA_MARK,
  normalizeSignName,
  PLANET_ORDER,
  signIndex,
  signLabel,
  SIGNS,
} from "@/lib/chart-theme";

export type RasiTemplateChartData = {
  lagna: string;
  planets: PlanetSignRow[];
  lagnaDegreeInSign?: number;
};

const VIEWBOX = 420;
const CENTER = VIEWBOX / 2;
const OUTER_RADIUS = 198;
const SIGN_RING_INNER_RADIUS = 171;
const HOUSE_RING_INNER_RADIUS = 144;
const INTERIOR_RING_RADIUS = 141;
const CORE_HALF = INTERIOR_RING_RADIUS * Math.sin(Math.PI / 12);
const GOLD = "#d4a84b";
const CREAM = "#f1ede5";
const BACKGROUND = "#0d0d0f";

/** เจ้าเรือนตามป้ายวงนอกของไฟล์ Horasard Template ราศีจักร.ai */
export const SIGN_RULER_NUMERALS = [
  "๓",
  "๖",
  "๔",
  "๒",
  "๑",
  "๔",
  "๖",
  "๓",
  "๕",
  "๗",
  "๘",
  "๕",
] as const;

/**
 * ตำแหน่งราศีในแบบพิมพ์: เมษอยู่บนสุด แล้วเรียงทวนเข็มนาฬิกาเสมอ
 * ลัคนาเปลี่ยนเฉพาะชื่อภพและเครื่องหมาย ล — ห้ามหมุนวงตามลัคนา
 */
export const TEMPLATE_SIGN_CENTERS = [
  { x: 210, y: 105 },
  { x: 148, y: 122 },
  { x: 114, y: 158 },
  { x: 105, y: 210 },
  { x: 114, y: 262 },
  { x: 148, y: 298 },
  { x: 210, y: 315 },
  { x: 272, y: 298 },
  { x: 306, y: 262 },
  { x: 315, y: 210 },
  { x: 306, y: 158 },
  { x: 272, y: 122 },
] as const;

function polar(radius: number, degree: number) {
  const rad = ((degree - 90) * Math.PI) / 180;
  return {
    x: CENTER + radius * Math.cos(rad),
    y: CENTER + radius * Math.sin(rad),
  };
}

function uprightRotation(degree: number): number {
  const normalized = ((degree % 360) + 360) % 360;
  if (normalized > 90 && normalized < 270) return normalized - 180;
  if (normalized >= 270) return normalized - 360;
  return normalized;
}

function coreTarget(boundaryIndex: number) {
  if (boundaryIndex === 0 || boundaryIndex >= 10) {
    return { x: CENTER - CORE_HALF, y: CENTER - CORE_HALF };
  }
  if (boundaryIndex <= 3) {
    return { x: CENTER + CORE_HALF, y: CENTER - CORE_HALF };
  }
  if (boundaryIndex <= 6) {
    return { x: CENTER + CORE_HALF, y: CENTER + CORE_HALF };
  }
  return { x: CENTER - CORE_HALF, y: CENTER + CORE_HALF };
}

const PLANET_RADIUS = 116;
const LAGNA_RADIUS = 100;
const STACK_RADIUS_STEP = 9;
const STACK_WITHIN_DEGREES = 6;

/** Polar point on the rasi wheel for a body at `degreeInSign` of `sign`. */
export function rasiOccupantPoint(
  sign: string,
  degreeInSign: number | undefined,
  stackIndex: number,
  kind: "planet" | "lagna",
) {
  const angle = signWheelAngle(signIndex(sign), degreeInSign ?? 15);
  const radius =
    (kind === "lagna" ? LAGNA_RADIUS : PLANET_RADIUS) - stackIndex * STACK_RADIUS_STEP;
  return polar(radius, angle);
}

function occupancyStackIndex(degrees: number[], index: number): number {
  let stack = 0;
  for (let i = 1; i <= index; i++) {
    if (Math.abs(degrees[i]! - degrees[i - 1]!) < STACK_WITHIN_DEGREES) {
      stack += 1;
    } else {
      stack = 0;
    }
  }
  return stack;
}

export function templateHouseLabels(lagna: string) {
  return SIGNS.map((sign) => bhavaNameFromLagna(lagna, sign));
}

export function RasiTemplateChart({
  chart,
  size = 420,
  className = "",
  onSelectPlanet,
  selectedPlanet,
}: {
  chart: RasiTemplateChartData;
  size?: number;
  className?: string;
  onSelectPlanet?: (planet: string) => void;
  selectedPlanet?: string | null;
}) {
  const lagna = normalizeSignName(chart.lagna);
  const planetsBySign = new Map<string, PlanetSignRow[]>();

  for (const row of [...chart.planets].sort(
    (a, b) =>
      PLANET_ORDER.indexOf(a.planet as (typeof PLANET_ORDER)[number]) -
      PLANET_ORDER.indexOf(b.planet as (typeof PLANET_ORDER)[number]),
  )) {
    const sign = normalizeSignName(row.siderealSign);
    planetsBySign.set(sign, [...(planetsBySign.get(sign) ?? []), row]);
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
      width={size}
      height={size}
      className={`h-auto max-w-full shrink-0 ${className}`}
      role="img"
      aria-label={`ราศีจักร ลัคนาราศี${signLabel(lagna)}`}
    >
      <title>{`ราศีจักร ลัคนาราศี${signLabel(lagna)}`}</title>
      <circle cx={CENTER} cy={CENTER} r={OUTER_RADIUS + 2} fill={BACKGROUND} />

      <g fill="none" stroke={GOLD} strokeLinecap="round">
        <circle cx={CENTER} cy={CENTER} r={OUTER_RADIUS} strokeWidth="1.25" />
        <circle
          cx={CENTER}
          cy={CENTER}
          r={SIGN_RING_INNER_RADIUS}
          strokeWidth="1"
        />
        <circle
          cx={CENTER}
          cy={CENTER}
          r={HOUSE_RING_INNER_RADIUS}
          strokeWidth="1"
        />
        <circle
          cx={CENTER}
          cy={CENTER}
          r={INTERIOR_RING_RADIUS}
          strokeWidth="0.75"
          opacity="0.78"
        />

        {Array.from({ length: 12 }, (_, index) => {
          const degree = -15 + index * 30;
          const outer = polar(OUTER_RADIUS, degree);
          const inner = polar(INTERIOR_RING_RADIUS, degree);
          const target = coreTarget(index);
          return (
            <g key={`boundary-${degree}`}>
              <line
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                strokeWidth="0.9"
              />
              <line
                x1={inner.x}
                y1={inner.y}
                x2={target.x}
                y2={target.y}
                strokeWidth="0.8"
                opacity="0.92"
              />
            </g>
          );
        })}

        <rect
          x={CENTER - CORE_HALF}
          y={CENTER - CORE_HALF}
          width={CORE_HALF * 2}
          height={CORE_HALF * 2}
          strokeWidth="0.8"
          opacity="0.92"
        />
      </g>

      {SIGNS.map((sign, index) => {
        const degree = -index * 30;
        const signPosition = polar(184.5, degree);
        const housePosition = polar(157.5, degree);
        const rotation = uprightRotation(degree);
        const houseName = bhavaNameFromLagna(lagna, sign);
        return (
          <g key={`${sign}-rings`}>
            <title>{`${houseName}: ${getHouseMeaning(houseName)}`}</title>
            <text
              x={signPosition.x}
              y={signPosition.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={GOLD}
              fontSize="11"
              fontWeight="650"
              transform={`rotate(${rotation} ${signPosition.x} ${signPosition.y})`}
            >
              {SIGN_RULER_NUMERALS[index]} {signLabel(sign)}
            </text>
            <text
              x={housePosition.x}
              y={housePosition.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={CREAM}
              fontSize="10"
              fontWeight="600"
              transform={`rotate(${rotation} ${housePosition.x} ${housePosition.y})`}
            >
              {houseName}
            </text>
          </g>
        );
      })}

      {SIGNS.map((sign) => {
        const planets = [...(planetsBySign.get(sign) ?? [])].sort(
          (a, b) => clampDegreeInSign(a.degreeInSign) - clampDegreeInSign(b.degreeInSign),
        );
        const entries = [
          ...(sign === lagna
            ? [
                {
                  planet: "ลัคนา",
                  symbol: LAGNA_MARK,
                  color: GOLD,
                  degreeText: undefined as string | undefined,
                  degreeInSign: clampDegreeInSign(chart.lagnaDegreeInSign ?? 15),
                  kind: "lagna" as const,
                },
              ]
            : []),
          ...planets.map((row) => ({
            planet: row.planet,
            symbol: getPlanetTheme(row.planet).numeral,
            color: getPlanetTheme(row.planet).color,
            degreeText: row.degreeText,
            degreeInSign: clampDegreeInSign(row.degreeInSign),
            kind: "planet" as const,
          })),
        ];
        return (
          <g key={`${sign}-occupants`}>
            {entries.map((entry, entryIndex) => {
              const { x, y } = rasiOccupantPoint(
                sign,
                entry.degreeInSign,
                occupancyStackIndex(
                  entries.map((item) => item.degreeInSign),
                  entryIndex,
                ),
                entry.kind,
              );
              const interactive = entry.planet !== "ลัคนา" && Boolean(onSelectPlanet);
              const selected = selectedPlanet === entry.planet;
              const select = () => {
                if (interactive) onSelectPlanet?.(entry.planet);
              };
              return (
                <g
                  key={`${sign}-${entry.planet}`}
                  role={interactive ? "button" : undefined}
                  tabIndex={interactive ? 0 : undefined}
                  aria-label={interactive ? `${entry.planet} ในราศี${signLabel(sign)}` : undefined}
                  onClick={select}
                  onKeyDown={
                    interactive
                      ? (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            select();
                          }
                        }
                      : undefined
                  }
                  style={interactive ? { cursor: "pointer", outline: "none" } : undefined}
                >
                  <title>
                    {entry.planet === "ลัคนา"
                      ? `ลัคนา ราศี${signLabel(sign)}`
                      : `${entry.planet} ราศี${signLabel(sign)}${entry.degreeText ? ` ${entry.degreeText}` : ""}`}
                  </title>
                  {interactive ? <circle cx={x} cy={y} r="20" fill="transparent" /> : null}
                  {selected ? (
                    <circle
                      cx={x}
                      cy={y}
                      r="15"
                      fill={BACKGROUND}
                      stroke={entry.color}
                      strokeWidth="1.5"
                    />
                  ) : null}
                  <text
                    x={x}
                    y={entry.degreeText ? y - 2 : y + 1}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={entry.color}
                    fontSize={entry.planet === "ลัคนา" ? "17" : "16"}
                    fontWeight={entry.planet === "ลัคนา" ? "700" : "600"}
                  >
                    {entry.symbol}
                  </text>
                  {entry.degreeText ? (
                    <text
                      x={x}
                      y={y + 9}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={CREAM}
                      fontSize="5.5"
                      fontWeight="500"
                      opacity="0.88"
                    >
                      {entry.degreeText.replace(/\s+/g, "")}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
