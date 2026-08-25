import { toGregorianYear } from "@/lib/date";
import { birthProfileSchema } from "@/lib/schemas";
import {
  computeNatalChart,
  computeNatalChartFormula,
} from "@/server/horoscope/engine/compute-chart";
import type { ChartJson } from "@/types/chart";
import type { z } from "zod";

export type PublicChartInput = z.infer<typeof birthProfileSchema>;

function normalizePublicInput(input: PublicChartInput) {
  const year = toGregorianYear(input.year, input.yearEra);
  const known = input.birthTimeKnown !== false;
  const time =
    known && input.hour !== undefined && input.minute !== undefined
      ? `${String(input.hour).padStart(2, "0")}:${String(input.minute).padStart(2, "0")}`
      : "12:00";

  return {
    day: input.day,
    month: input.month,
    year,
    time,
    country: input.birthCountry?.trim() || "ไทย",
    province: input.birthProvince,
    district: input.birthDistrict?.trim() || "",
  };
}

/**
 * Public calculator uses the same detailed MyHora/Samrap path as the original
 * hora-ai chart. If the reference is unavailable, fall back to the local
 * Suriyayat/formula engine without failing the form.
 */
export async function computePublicNatalChart(
  input: PublicChartInput,
  options?: { scrape?: boolean },
): Promise<ChartJson> {
  const normalized = normalizePublicInput(input);
  if (options?.scrape === false) return computeNatalChartFormula(normalized);
  return computeNatalChart(normalized, { scrapeTimeoutMs: 10_000 });
}
