import { toGregorianYear } from "@/lib/date";
import { birthProfileSchema } from "@/lib/schemas";
import { computeNatalChartFormula } from "@/server/horoscope/engine/compute-chart";
import type { ChartJson } from "@/types/chart";
import type { z } from "zod";

export type PublicChartInput = z.infer<typeof birthProfileSchema>;

/** Formula-only natal chart — no scrape, no DB, no account. */
export function computePublicNatalChart(input: PublicChartInput): ChartJson {
  const year = toGregorianYear(input.year, input.yearEra);
  const known = input.birthTimeKnown !== false;
  const time =
    known && input.hour !== undefined && input.minute !== undefined
      ? `${String(input.hour).padStart(2, "0")}:${String(input.minute).padStart(2, "0")}`
      : "12:00";

  return computeNatalChartFormula({
    day: input.day,
    month: input.month,
    year,
    time,
    country: input.birthCountry?.trim() || "ไทย",
    province: input.birthProvince,
    district: input.birthDistrict || input.birthProvince,
  });
}
