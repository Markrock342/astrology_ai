import "@/server/horoscope/engine/taksa-boundaries";
import type { ChartJson } from "@/types/chart";
import { computeNatalChartFormula } from "@/server/horoscope/engine/compute-chart";
import { resolveTaksaBirthDay } from "@/lib/taksa";
import {
  COMPANION_RELATION_LABEL,
  RELATION_HOUSES,
  type Companion,
} from "@/lib/companions";
import {
  computeSynastry,
  formatCompanionChart,
  formatSynastryForPrompt,
} from "@/lib/synastry";
import { fetchSompong, formatSompongForPrompt } from "@/server/horoscope/sompong-service";

/**
 * Charts for the other people in a question, and what ties each to the user.
 *
 * Computed with the local engine — the same Thai 100-year ephemeris the
 * user's own chart falls back to — so a few people cost milliseconds and no
 * network. Their birth data is used for this answer only; the prompt carries
 * their chart and weekday, not the date itself.
 */
/** ดวงสมพงษ์ is a couples' reading; for a parent or a child it says nothing. */
const SOMPONG_RELATIONS = new Set(["partner", "spouse", "business"]);

export async function buildCompanionsPrompt(
  user: ChartJson,
  companions: Companion[],
): Promise<string | null> {
  if (!companions.length) return null;
  const userSide = {
    lagna: user.chart?.lagna ?? user.meta.lagna ?? null,
    planets: user.planets,
  };

  const blocks = await Promise.all(companions.map(async (c, i) => {
    const index = i + 1;
    const [year, month, day] = c.birthDate.split("-").map(Number) as [number, number, number];
    const timeKnown = Boolean(c.birthTime);
    const input = {
      day,
      month,
      year,
      time: c.birthTime ?? "12:00",
      country: c.country || "ไทย",
      province: c.province,
      district: c.district ?? "",
    };
    const chart = computeNatalChartFormula(input);
    const side = {
      // An unknown birth time gives a noon lagna — a guess, so it is withheld.
      lagna: timeKnown ? (chart.chart?.lagna ?? chart.meta.lagna ?? null) : null,
      planets: chart.planets,
    };
    const relation = COMPANION_RELATION_LABEL[c.relation];
    // "พ่อ (พ่อ)" reads badly when the nickname already is the relation.
    const label = c.nickname === relation ? c.nickname : `${c.nickname} (${relation})`;
    const weekday = timeKnown ? resolveTaksaBirthDay(input) : null;
    const synastry = computeSynastry(userSide, side, RELATION_HOUSES[c.relation]);
    const sompong = SOMPONG_RELATIONS.has(c.relation)
      ? await fetchSompong(
          { year: user.input.year, month: user.input.month, day: user.input.day },
          { year, month, day },
        )
      : null;
    return [
      ...formatCompanionChart(index, label, weekday, side),
      ...formatSynastryForPrompt(index, label, synastry, c.nickname),
      ...(sompong ? formatSompongForPrompt(index, c.nickname, sompong) : []),
    ].join("\n");
  }));
  return blocks.join("\n\n");
}
