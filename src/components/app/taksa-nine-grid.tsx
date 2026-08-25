"use client";

import type { BirthInputSnapshot, TaksaSlot } from "@/types/chart";
import type { MyhoraTaksaCell } from "@/types/myhora";
import { toThaiNumeral } from "@/lib/chart-theme";
import {
  combinedGridFromScraped,
  computeTransitTaksaByAge,
  computeTransitTaksaMethod1,
  formatTaksaDayHeading,
  resolveTaksaBirthDay,
  resolveTaksaSlots,
  TAKSA_CELL_PLANETS,
  TAKSA_PLANET_NAMES,
  TAKSA_TRANSIT_NAMES,
  type TaksaMode,
} from "@/lib/taksa";

const GOLD = "#d4a84b";
const CREAM = "#f1ede5";

function transitSlotsFromScraped(
  scraped: (MyhoraTaksaCell | null)[][] | null | undefined,
): TaksaSlot[] | null {
  const cells = combinedGridFromScraped(scraped);
  if (!cells) return null;
  const byLabel = new Map<string, TaksaSlot>();
  for (const cell of cells) {
    if (cell.isCenter || !cell.transitLabel) continue;
    if (!TAKSA_TRANSIT_NAMES.includes(cell.transitLabel as (typeof TAKSA_TRANSIT_NAMES)[number])) {
      continue;
    }
    byLabel.set(cell.transitLabel, {
      taksa: cell.transitLabel,
      planet: TAKSA_PLANET_NAMES[cell.planetNum] ?? String(cell.planetNum),
      planetNum: cell.planetNum,
      index: TAKSA_TRANSIT_NAMES.indexOf(
        cell.transitLabel as (typeof TAKSA_TRANSIT_NAMES)[number],
      ),
    });
  }
  if (byLabel.size !== TAKSA_TRANSIT_NAMES.length) return null;
  return TAKSA_TRANSIT_NAMES.map((name) => byLabel.get(name)!);
}

export function TaksaNineGrid({
  title,
  input,
  slots,
  scraped,
  asOf,
  mode = "natal",
  countFromCenter = true,
  onCountFromCenterChange,
  transitInput,
}: {
  title?: string;
  input: BirthInputSnapshot;
  slots?: TaksaSlot[] | null;
  scraped?: (MyhoraTaksaCell | null)[][] | null;
  asOf?: Date;
  mode?: TaksaMode;
  countFromCenter?: boolean;
  onCountFromCenterChange?: (next: boolean) => void;
  /** When set, ทักษาจร uses Method-1 for that date instead of age. */
  transitInput?: BirthInputSnapshot | null;
}) {
  const now = asOf ?? new Date();
  const natalDay = resolveTaksaBirthDay(input);
  const ageTransit = computeTransitTaksaByAge(input, now, countFromCenter);
  const scrapedTransit = transitSlotsFromScraped(scraped);

  const resolved =
    mode === "transit"
      ? transitInput
        ? computeTransitTaksaMethod1(transitInput)
        : countFromCenter && scrapedTransit
          ? scrapedTransit
          : ageTransit.slots.filter((slot) => slot.taksa)
      : resolveTaksaSlots(input, slots);

  const heading =
    title ?? (mode === "transit" ? "ทักษาจร" : "ทักษากำเนิด / ทักษาเดิม");
  const dayHeading =
    mode === "transit"
      ? transitInput
        ? formatTaksaDayHeading(resolveTaksaBirthDay(transitInput), "transit")
        : `อายุย่างเข้า ${toThaiNumeral(ageTransit.yangKao)}`
      : formatTaksaDayHeading(natalDay, "natal");
  const centerIsBorivan =
    mode === "transit" && !transitInput && ageTransit.centerIsBorivanTransit;

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
              slot?.taksa === "บริวาร" ||
              slot?.taksa === "บริวารจร" ||
              (isCenter && centerIsBorivan);
            return (
              <div
                key={`${mode}-${planetNum}`}
                className="relative flex min-h-[4.8rem] flex-col items-center justify-center border-b border-r px-1 py-1.5 text-center last:border-r-0"
                style={{ borderColor: `${GOLD}99` }}
              >
                {isCenter ? (
                  <span
                    className={`flex flex-col items-center justify-center ${
                      isBorivan ? "rounded-full border px-2 py-1" : ""
                    }`}
                    style={isBorivan ? { borderColor: GOLD } : undefined}
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
                    {centerIsBorivan ? (
                      <span
                        className="mt-1 text-[9px] font-medium leading-none"
                        style={{ color: CREAM }}
                      >
                        บริวารจร
                      </span>
                    ) : (
                      <span className="sr-only">ตากลาง เกตุ</span>
                    )}
                  </span>
                ) : slot ? (
                  <span
                    className={`flex h-[3.7rem] w-[3.7rem] flex-col items-center justify-center ${
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
      {mode === "transit" && !transitInput && onCountFromCenterChange ? (
        <label className="mt-2.5 flex cursor-pointer items-center justify-center gap-2 text-[11px] text-[#d4a84b]/90">
          <input
            type="checkbox"
            checked={countFromCenter}
            onChange={(event) => onCountFromCenterChange(event.target.checked)}
            className="size-3.5 accent-[#d4a84b]"
          />
          นับอายุจรตากลาง
        </label>
      ) : null}
    </figure>
  );
}
