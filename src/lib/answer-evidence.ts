/**
 * The few chart facts a question turns on, picked out for the model.
 *
 * The prompt carries every house's chain, every planet and every transit;
 * a fast model asked "เงินจะเข้าไหม" had to find the money houses itself, and
 * often quoted whatever came first (career, mostly). Here the asked houses'
 * sign, lord, where the lord sits, the planets inside and the transits on
 * them are set out first, as the reasons to use.
 */
import { HOUSE_MEANING, HOUSE_NAMES, houseFromLagna, normalizeSignName } from "@/lib/chart-theme";
import type { HouseChain } from "@/lib/house-chains";
import type { TransitNatalLink } from "@/lib/transit-to-natal";

type PlanetRow = { planet: string; siderealSign: string };

function houseLabel(house: number): string {
  const name = HOUSE_NAMES[house - 1];
  return name ? `ภพ ${house} ${name} (${HOUSE_MEANING[name]})` : `ภพ ${house}`;
}

export function formatAnswerEvidence(input: {
  focusHouses: number[];
  chains: HouseChain[];
  lagna: string | null | undefined;
  natalPlanets: PlanetRow[];
  /** Transit links for the period asked about, when it is a transit question. */
  transitLinks?: TransitNatalLink[] | null;
}): string[] {
  const lagna = input.lagna ? normalizeSignName(input.lagna) : null;
  if (!lagna || !input.focusHouses.length || !input.chains.length) return [];
  const lines: string[] = [
    "[answer_evidence] หลักฐานหลักของคำถามนี้ (คัดจากข้อมูลด้านบนแล้ว — ใช้ข้อเหล่านี้เป็นเหตุผลหลัก 2–4 ข้อ " +
      "แปลเป็นภาษาคนทั่วไป และไม่ต้องไล่ภพอื่นที่ไม่เกี่ยวกับคำถาม):",
  ];
  for (const house of input.focusHouses) {
    const step = input.chains.find((c) => c.startHouse === house)?.steps[0];
    if (!step) continue;
    const lordAt = step.lordHouse
      ? `ไปอยู่${houseLabel(step.lordHouse)}${step.dignity && !["—", "ปกติ"].includes(step.dignity) ? ` เป็น${step.dignity}` : ""}`
      : "ไม่พบตำแหน่ง";
    const inside = input.natalPlanets
      .filter((p) => p.planet !== "เกตุ" && houseFromLagna(lagna, p.siderealSign) === house)
      .map((p) => p.planet);
    const facts = [
      `ราศี${normalizeSignName(step.sign)} เจ้าเรือนคือ${step.lord} ${lordAt}`,
      inside.length ? `ดาวเดิมในภพนี้: ${inside.join(" ")}` : "ไม่มีดาวเดิมในภพนี้",
    ];
    const links = input.transitLinks ?? [];
    const passing = links.filter((l) => l.natalHouse === house).map((l) => `${l.transitPlanet}จรเดินเข้าภพนี้`);
    const onLord = links
      .filter((l) => l.natalHouse !== house)
      .flatMap((l) =>
        l.contacts.filter((c) => c.natalBody === step.lord).map((c) => `${l.transitPlanet}จร${c.kind}${step.lord}เดิม (เจ้าเรือนนี้)`),
      );
    if (input.transitLinks) {
      facts.push(passing.length || onLord.length ? `ช่วงที่ถาม: ${[...passing, ...onLord].slice(0, 4).join(" · ")}` : "ช่วงที่ถาม: ไม่มีดาวจรกระทบภพนี้โดยตรง");
    }
    lines.push(`- ${houseLabel(house)}: ${facts.join(" · ")}`);
  }
  return lines.length > 1 ? lines : [];
}
