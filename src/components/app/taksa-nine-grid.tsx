"use client";

import type { PlanetSignRow, TaksaSlot } from "@/types/chart";
import {
  getPlanetTheme,
  LAGNA_MARK,
  normalizeSignName,
  PLANET_ORDER,
  signLabel,
  toThaiNumeral,
} from "@/lib/chart-theme";
import {
  planetsInSign,
  resolveTaksaSlots,
  TAKSA_CELL_NUMBERS,
  taksaIndexFromCellNumber,
} from "@/lib/taksa";

export function TaksaNineGrid({
  title,
  lagna,
  slots,
  planets,
}: {
  title: string;
  lagna: string;
  slots?: TaksaSlot[] | null;
  planets: PlanetSignRow[];
}) {
  const resolved = resolveTaksaSlots(lagna, slots);
  const lagnaSign = normalizeSignName(lagna);

  return (
    <div className="min-w-0">
      <p className="mb-2 text-center text-xs font-semibold tracking-wide text-[var(--primary)]">
        {title}
      </p>
      <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-[var(--border)]">
        {TAKSA_CELL_NUMBERS.flatMap((row) =>
          row.map((cell) => {
            const slot = resolved[taksaIndexFromCellNumber(cell)];
            const sign = slot?.sign ?? "เมษ";
            const isCenter = cell === 9;
            const isLagnaSign = normalizeSignName(sign) === lagnaSign;
            const occupants = planetsInSign(planets, sign).sort(
              (a, b) =>
                PLANET_ORDER.indexOf(a.planet as (typeof PLANET_ORDER)[number]) -
                PLANET_ORDER.indexOf(b.planet as (typeof PLANET_ORDER)[number]),
            );
            return (
              <div
                key={`${title}-${cell}`}
                className={`flex min-h-[4.75rem] flex-col items-center justify-center gap-0.5 border-b border-r border-[var(--border)] px-1 py-1.5 text-center last:border-r-0 ${
                  isCenter || isLagnaSign
                    ? "bg-[var(--primary)]/16"
                    : "bg-[var(--surface-2)]/55"
                }`}
              >
                <span
                  className={`text-lg font-semibold leading-none ${
                    isCenter ? "text-[var(--primary)]" : "text-[var(--foreground)]"
                  }`}
                >
                  {toThaiNumeral(cell)}
                </span>
                <span className="text-[10px] text-[var(--muted)]">
                  {signLabel(sign)}
                  {isLagnaSign ? ` ${LAGNA_MARK}` : ""}
                </span>
                {slot ? (
                  <span className="text-[9px] text-[var(--muted-2)]">{slot.taksa}</span>
                ) : null}
                {occupants.length > 0 ? (
                  <span className="mt-0.5 flex flex-wrap justify-center gap-x-1 text-sm font-semibold leading-none">
                    {occupants.map((row) => {
                      const theme = getPlanetTheme(row.planet);
                      return (
                        <span
                          key={`${sign}-${row.planet}`}
                          style={{ color: theme.color }}
                          title={`${theme.numeral} ${row.planet}`}
                        >
                          {theme.numeral}
                        </span>
                      );
                    })}
                  </span>
                ) : null}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}
