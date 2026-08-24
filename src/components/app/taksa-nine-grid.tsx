"use client";

import type { BirthInputSnapshot, TaksaSlot } from "@/types/chart";
import { getPlanetTheme, toThaiNumeral } from "@/lib/chart-theme";
import {
  resolveTaksaBirthDay,
  resolveTaksaSlots,
  TAKSA_CELL_PLANETS,
  TAKSA_PLANET_NAMES,
} from "@/lib/taksa";

export function TaksaNineGrid({
  title,
  input,
  slots,
}: {
  title: string;
  input: BirthInputSnapshot;
  slots?: TaksaSlot[] | null;
}) {
  const resolved = resolveTaksaSlots(input, slots);
  const birthDay = resolveTaksaBirthDay(input);

  return (
    <div className="mx-auto w-full min-w-0 max-w-md">
      <div className="mb-3 text-center">
        <p className="text-xs font-semibold tracking-wide text-[var(--primary)]">{title}</p>
        <p className="mt-1 text-[11px] text-[var(--muted)]">
          เกิดวัน{birthDay} · คำนวณจากวันและเวลาเกิด
        </p>
      </div>
      <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-[var(--border)]">
        {TAKSA_CELL_PLANETS.flatMap((row) =>
          row.map((planetNum) => {
            const planet = TAKSA_PLANET_NAMES[planetNum] ?? "เกตุ";
            const slot = resolved.find((item) => item.planetNum === planetNum);
            const theme = getPlanetTheme(planet);
            const isCenter = planetNum === 9;
            return (
              <div
                key={`${title}-${planetNum}`}
                className={`flex min-h-[5.25rem] flex-col items-center justify-center gap-1 border-b border-r border-[var(--border)] px-2 py-2 text-center ${
                  isCenter ? "bg-[var(--background)]" : "bg-[var(--surface-2)]/55"
                }`}
              >
                <span
                  className="text-xl font-semibold leading-none"
                  style={{ color: theme.color }}
                  aria-label={`${planetNum} ${planet}`}
                >
                  {toThaiNumeral(planetNum)}
                </span>
                <span className="text-[10px] text-[var(--muted)]">{planet}</span>
                {slot ? (
                  <span className="text-xs font-medium text-[var(--foreground)]">{slot.taksa}</span>
                ) : (
                  <span className="text-[10px] text-[var(--muted-2)]">ตากลาง</span>
                )}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}
