"use client";

import { useState } from "react";
import type { BirthInputSnapshot, TaksaSlot } from "@/types/chart";
import type { MyhoraTaksaCell } from "@/types/myhora";
import { toThaiNumeral } from "@/lib/chart-theme";
import {
  buildCombinedTaksaGrid,
  combinedGridFromScraped,
  computeTransitTaksaByAge,
  formatTaksaDayHeading,
  resolveTaksaBirthDay,
  resolveTaksaSlots,
  TAKSA_PLANET_NAMES,
  type CombinedTaksaCell,
} from "@/lib/taksa";

const GOLD = "#d4a84b";
const CREAM = "#f1ede5";

export function TaksaNineGrid({
  title,
  input,
  slots,
  scraped,
  asOf,
}: {
  title?: string;
  input: BirthInputSnapshot;
  slots?: TaksaSlot[] | null;
  scraped?: (MyhoraTaksaCell | null)[][] | null;
  /** Test hook so markup does not depend on the wall clock. */
  asOf?: Date;
}) {
  const [countFromCenter, setCountFromCenter] = useState(true);
  const now = asOf ?? new Date();
  const natalSlots = resolveTaksaSlots(input, slots);
  const ageTransit = computeTransitTaksaByAge(input, now, countFromCenter);
  const scrapedGrid = combinedGridFromScraped(scraped);
  const cells: CombinedTaksaCell[] =
    countFromCenter && scrapedGrid
      ? scrapedGrid
      : buildCombinedTaksaGrid(
          natalSlots,
          ageTransit.slots,
          ageTransit.centerIsBorivanTransit,
        );

  const day = resolveTaksaBirthDay(input);
  const heading = title ?? "ทักษา";
  const dayHeading = formatTaksaDayHeading(day, "natal");

  return (
    <figure className="mx-auto w-full min-w-0 max-w-[18.5rem]">
      <figcaption className="mb-2 text-center">
        <p className="text-[11px] font-semibold tracking-wide text-[var(--primary)]">
          {heading}
        </p>
        <p className="mt-0.5 text-[10px] text-[#d4a84b]/85">
          {dayHeading}
          {" · "}
          อายุย่างเข้า {toThaiNumeral(ageTransit.yangKao)}
        </p>
      </figcaption>
      <div
        className="grid grid-cols-3 overflow-hidden border"
        style={{ borderColor: GOLD, background: "#0d0d0f" }}
        role="img"
        aria-label={`${heading} ${dayHeading} ทักษาจรอายุย่างเข้า ${ageTransit.yangKao}`}
      >
        {cells.map((cell) => {
          const planet = TAKSA_PLANET_NAMES[cell.planetNum] ?? "เกตุ";
          return (
            <div
              key={cell.planetNum}
              className="relative flex min-h-[5.1rem] flex-col items-center justify-center border-b border-r px-0.5 py-1 text-center last:border-r-0"
              style={{ borderColor: `${GOLD}99` }}
            >
              {cell.isCenter ? (
                <span
                  className={`flex flex-col items-center justify-center ${
                    cell.highlightTransit ? "rounded-full border px-2 py-1" : ""
                  }`}
                  style={
                    cell.highlightTransit ? { borderColor: GOLD } : undefined
                  }
                >
                  <span
                    className="flex items-center gap-0.5 text-[10px] leading-none"
                    style={{ color: `${GOLD}99` }}
                    aria-hidden
                  >
                    <span>↙</span>
                    <span>↑</span>
                  </span>
                  <span
                    className="mt-0.5 text-lg font-semibold leading-none"
                    style={{ color: `${GOLD}aa` }}
                    aria-label={`๙ ${planet}`}
                  >
                    {toThaiNumeral(9)}
                  </span>
                  {cell.transitLabel ? (
                    <span
                      className="mt-1 text-[8px] font-medium leading-none"
                      style={{ color: GOLD }}
                    >
                      {cell.transitLabel}
                    </span>
                  ) : (
                    <span className="sr-only">ตากลาง เกตุ</span>
                  )}
                </span>
              ) : (
                <span
                  className={`flex h-[4.35rem] w-[4.35rem] flex-col items-center justify-center ${
                    cell.highlightTransit ? "rounded-full border" : ""
                  }`}
                  style={
                    cell.highlightTransit ? { borderColor: GOLD } : undefined
                  }
                >
                  <span
                    className="text-[9px] font-medium leading-none"
                    style={{ color: CREAM }}
                  >
                    {cell.natalLabel}
                  </span>
                  <span
                    className="mt-1 text-lg font-semibold leading-none"
                    style={{ color: GOLD }}
                    aria-label={`${cell.planetNum} ${planet}`}
                  >
                    {toThaiNumeral(cell.planetNum)}
                  </span>
                  {cell.transitLabel ? (
                    <span
                      className="mt-1 text-[8px] font-medium leading-tight"
                      style={{ color: GOLD }}
                    >
                      {cell.transitLabel}
                    </span>
                  ) : null}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <label className="mt-2.5 flex cursor-pointer items-center justify-center gap-2 text-[11px] text-[#d4a84b]/90">
        <input
          type="checkbox"
          checked={countFromCenter}
          onChange={(event) => setCountFromCenter(event.target.checked)}
          className="size-3.5 accent-[#d4a84b]"
        />
        นับอายุจรตากลาง
      </label>
    </figure>
  );
}
