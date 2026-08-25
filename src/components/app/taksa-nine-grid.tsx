"use client";

import type { BirthInputSnapshot, TaksaSlot } from "@/types/chart";
import { toThaiNumeral } from "@/lib/chart-theme";
import {
  computeTransitTaksaMethod1,
  formatTaksaDayHeading,
  resolveTaksaBirthDay,
  resolveTaksaSlots,
  TAKSA_CELL_PLANETS,
  TAKSA_PLANET_NAMES,
  type TaksaMode,
} from "@/lib/taksa";

const GOLD = "#d4a84b";
const CREAM = "#f1ede5";

export function TaksaNineGrid({
  title,
  input,
  slots,
  mode = "natal",
}: {
  title?: string;
  input: BirthInputSnapshot;
  slots?: TaksaSlot[] | null;
  /** natal = ทักษาเดิม; transit = Method-1 ทักษาวันจร */
  mode?: TaksaMode;
}) {
  const resolved =
    mode === "transit"
      ? computeTransitTaksaMethod1(input)
      : resolveTaksaSlots(input, slots);
  const day = resolveTaksaBirthDay(input);
  const heading =
    title ?? (mode === "transit" ? "ทักษาจร" : "ทักษากำเนิด / ทักษาเดิม");
  const dayHeading = formatTaksaDayHeading(day, mode);

  return (
    <figure className="mx-auto w-full min-w-0 max-w-[17.5rem]">
      <figcaption className="mb-2 text-center">
        <p className="text-[11px] font-semibold tracking-wide text-[var(--primary)]">
          {heading}
        </p>
        <p className="mt-0.5 text-[10px] text-[#d4a84b]/85">{dayHeading}</p>
      </figcaption>
      <div
        className="grid grid-cols-3 overflow-hidden border"
        style={{ borderColor: GOLD, background: "#0d0d0f" }}
        role="img"
        aria-label={`${heading} ${dayHeading}`}
      >
        {TAKSA_CELL_PLANETS.flatMap((row) =>
          row.map((planetNum) => {
            const planet = TAKSA_PLANET_NAMES[planetNum] ?? "เกตุ";
            const slot = resolved.find((item) => item.planetNum === planetNum);
            const isCenter = planetNum === 9;
            const isBorivan =
              slot?.taksa === "บริวาร" || slot?.taksa === "บริวารจร";
            return (
              <div
                key={`${mode}-${planetNum}`}
                className="relative flex min-h-[4.6rem] flex-col items-center justify-center border-b border-r px-1 py-1.5 text-center last:border-r-0"
                style={{ borderColor: `${GOLD}99` }}
              >
                {isCenter ? (
                  <span className="sr-only">ตากลาง เกตุ</span>
                ) : slot ? (
                  <span
                    className={`flex h-[3.55rem] w-[3.55rem] flex-col items-center justify-center ${
                      isBorivan ? "rounded-full border" : ""
                    }`}
                    style={isBorivan ? { borderColor: GOLD } : undefined}
                  >
                    <span
                      className="text-[9px] font-medium leading-none"
                      style={{ color: CREAM }}
                    >
                      {slot.taksa}
                    </span>
                    <span
                      className="mt-1 text-lg font-semibold leading-none"
                      style={{ color: GOLD }}
                      aria-label={`${planetNum} ${planet}`}
                    >
                      {toThaiNumeral(planetNum)}
                    </span>
                  </span>
                ) : null}
              </div>
            );
          }),
        )}
      </div>
    </figure>
  );
}
