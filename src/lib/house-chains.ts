import type { PlanetSignRow, TaksaSlot } from "@/types/chart";
import { computeChartAspects, houseFromSign } from "@/lib/chart-aspects";
import { HOUSE_NAMES, normalizeSignName, SIGNS } from "@/lib/chart-theme";
import { dignityLabel, elementOf, lordOfSign } from "@/lib/thai-dignity";

/**
 * ภพผสมภพ, computed.
 *
 * The team's method follows a topic's house lord to the house it sits in,
 * then that house's lord, and so on until a lord is home (เกษตร) or the story
 * loops back. Asked of the model, a chain like that gets cut short or made up
 * — "ห้ามสรุปลัด ห้ามข้ามขั้น" is exactly what it cannot guarantee. So the
 * chains are walked here and handed over as facts; the model's job is to tell
 * them as one story.
 */
export type ChainContact = {
  kind: "ร่วมเรือน" | "เล็ง" | "ตรีโกณ" | "จตุโกณ";
  body: string;
  /** "ไฟ–ดิน" etc., from the team's element table; null when either lacks one. */
  elements: string | null;
  sameElement: boolean;
};

export type ChainStep = {
  house: number;
  sign: string;
  lord: string;
  /** Where the lord sits; null when the chart has no row for it. */
  lordSign: string | null;
  lordHouse: number | null;
  dignity: string;
  taksa: string | null;
  contacts: ChainContact[];
};

export type HouseChain = {
  startHouse: number;
  steps: ChainStep[];
  /** Why the chain stopped, in the team's own terms. */
  ending: string;
};

const MAX_STEPS = 6;

function signOfHouse(lagna: string, house: number): string | null {
  const idx = (SIGNS as readonly string[]).indexOf(normalizeSignName(lagna));
  if (idx < 0) return null;
  return SIGNS[(idx + house - 1) % 12] ?? null;
}

function houseName(house: number): string {
  return HOUSE_NAMES[house - 1] ?? `ภพ${house}`;
}

export function buildHouseChains(input: {
  lagna: string | null | undefined;
  planets: PlanetSignRow[];
  taksa?: TaksaSlot[] | null;
}): HouseChain[] {
  const lagna = input.lagna ? normalizeSignName(input.lagna) : null;
  if (!lagna || !(SIGNS as readonly string[]).includes(lagna)) return [];

  const rows = input.planets
    .map((p) => ({ planet: p.planet, sign: normalizeSignName(p.siderealSign) }))
    .filter((p) => (SIGNS as readonly string[]).includes(p.sign));
  const rowOf = (planet: string) => rows.find((r) => r.planet === planet) ?? null;

  const taksaOf = new Map<string, string>();
  for (const slot of input.taksa ?? []) {
    if (slot.planet) taksaOf.set(slot.planet, slot.taksa);
  }

  const aspects = computeChartAspects(input.planets, lagna);
  const contactsOf = (planet: string): ChainContact[] =>
    aspects
      .filter((a) => a.a.name === planet || a.b.name === planet)
      .map((a) => {
        const other = a.a.name === planet ? a.b.name : a.a.name;
        const e1 = elementOf(planet);
        const e2 = other === "ลัคนา" ? null : elementOf(other);
        return {
          kind: a.kind === "กุม" ? ("ร่วมเรือน" as const) : a.kind,
          body: other,
          elements: e1 && e2 ? `${e1}–${e2}` : null,
          sameElement: Boolean(e1 && e2 && e1 === e2),
        };
      });

  const chains: HouseChain[] = [];
  for (let start = 1; start <= 12; start += 1) {
    const steps: ChainStep[] = [];
    const visited = new Set<number>();
    let house = start;
    let ending = `ไล่ครบ ${MAX_STEPS} ทอดแล้ว หยุดที่นี่`;

    for (let i = 0; i < MAX_STEPS; i += 1) {
      visited.add(house);
      const sign = signOfHouse(lagna, house);
      const lord = sign ? lordOfSign(sign) : null;
      if (!sign || !lord) {
        ending = "ไม่มีเจ้าเรือนให้ตามต่อ";
        break;
      }
      const row = rowOf(lord);
      const lordHouse = row ? houseFromSign(lagna, row.sign) : null;
      steps.push({
        house,
        sign,
        lord,
        lordSign: row?.sign ?? null,
        lordHouse,
        dignity: row ? dignityLabel(lord, row.sign) : "—",
        taksa: taksaOf.get(lord) ?? null,
        contacts: row ? contactsOf(lord) : [],
      });
      if (!row || !lordHouse) {
        ending = `ไม่พบตำแหน่ง${lord}ในตาราง`;
        break;
      }
      if (lordOfSign(row.sign) === lord) {
        ending = `${lord}อยู่บ้านตัวเอง (เกษตร) ที่ภพ ${lordHouse} ${houseName(lordHouse)} — จบสายเรื่อง`;
        break;
      }
      if (visited.has(lordHouse)) {
        ending = `วนกลับมาที่ภพ ${lordHouse} ${houseName(lordHouse)} — จบสายเรื่อง`;
        break;
      }
      house = lordHouse;
    }
    chains.push({ startHouse: start, steps, ending });
  }
  return chains;
}

function contactText(c: ChainContact): string {
  const pair = c.elements
    ? c.sameElement
      ? ` (คู่ธาตุ${c.elements.split("–")[0]})`
      : ` (ธาตุ${c.elements})`
    : "";
  return c.kind === "ร่วมเรือน" ? `ร่วมเรือนกับ${c.body}${pair}` : `${c.kind}${c.body}${pair}`;
}

/** One line per planet, written once — the chains below only point at them. */
export function formatPlanetFactsForPrompt(chains: HouseChain[]): string[] {
  const seen = new Map<string, ChainStep>();
  for (const chain of chains) {
    for (const step of chain.steps) {
      if (step.lordSign && step.lordHouse && !seen.has(step.lord)) seen.set(step.lord, step);
    }
  }
  if (!seen.size) return [];
  const lines = [
    "[planet_facts] ข้อเท็จจริงของดาวเจ้าเรือนในพื้นดวง — มาตรฐานดาว ทักษาเดิม ธาตุ ดาวร่วมเรือน และมุม " +
      "(คำนวณแล้ว ห้ามเดา ธาตุใช้ตารางของระบบเท่านั้น):",
  ];
  for (const step of seen.values()) {
    const element = elementOf(step.lord);
    const facts = [
      `ราศี${normalizeSignName(step.lordSign!)} ภพ ${step.lordHouse} ${houseName(step.lordHouse!)}`,
      step.dignity !== "—" ? step.dignity : null,
      step.taksa ? `ทักษา${step.taksa}` : null,
      element ? `ธาตุ${element}` : null,
      ...step.contacts.map(contactText),
    ].filter(Boolean);
    lines.push(`- ${step.lord} ${facts.join(" · ")}`);
  }
  return lines;
}

export function formatHouseChainsForPrompt(chains: HouseChain[]): string[] {
  if (!chains.length) return [];
  const lines = [
    "[house_chains] ภพผสมภพของทุกภพ — ตามดาวเจ้าเรือนเป็นทอด ๆ จนดาวอยู่บ้านตัวเองหรือวนกลับ " +
      "(คำนวณจาก [natal] แล้ว ห้ามไล่ใหม่เอง ห้ามข้ามทอด รายละเอียดของดาวแต่ละดวงอยู่ใน [planet_facts]):",
  ];
  for (const chain of chains) {
    const first = chain.steps[0];
    const head = `- ภพ ${chain.startHouse} ${houseName(chain.startHouse)}${
      first ? ` (ราศี${normalizeSignName(first.sign)})` : ""
    }:`;
    const hops = chain.steps.map((step, i) => {
      const who = i === 0 ? `เจ้าเรือน${step.lord}` : `เจ้าภพ ${step.house} คือ${step.lord}`;
      return step.lordHouse
        ? `${who} ไปสถิตภพ ${step.lordHouse} ${houseName(step.lordHouse)}`
        : `${who} ไม่พบตำแหน่ง`;
    });
    lines.push(`${head} ${[...hops, chain.ending].join(" ⟶ ")}`);
  }
  return lines;
}
