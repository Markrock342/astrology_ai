import type { PlanetSignRow } from "@/types/chart";
import {
  aspectKindFromHouse,
  houseFromSign,
  type AspectKind,
} from "@/lib/chart-aspects";
import { HOUSE_NAMES, normalizeSignName, SIGNS } from "@/lib/chart-theme";
import { dignityLabel, elementOf, lordOfSign } from "@/lib/thai-dignity";

/**
 * Two charts read together, computed rather than asked for.
 *
 * Left to the model, a "does my chart suit my partner's" answer compares two
 * tables it has to cross-reference itself — which is where invented aspects
 * come from. The contacts between the charts are worked out here: how the two
 * lagnas stand, where each person's planets fall in the other's houses, which
 * planets sit on or face each other, and the element of every pair in the
 * team's own element table.
 */
export type ChartSide = {
  /** null when the birth time is unknown: no lagna, no houses. */
  lagna: string | null;
  planets: PlanetSignRow[];
};

export type CrossContact = {
  kind: AspectKind;
  userPlanet: string;
  otherPlanet: string;
  elements: string | null;
  sameElement: boolean;
};

export type Placement = { planet: string; sign: string; house: number };

export type Synastry = {
  lagnaRelation: { kind: AspectKind | null; house: number } | null;
  otherInUserHouses: Placement[];
  userInOtherHouses: Placement[];
  contacts: CrossContact[];
  /** For each house the relationship is read from: its lord and who lands there. */
  relationHouses: Array<{
    house: number;
    lord: string | null;
    lordAt: { sign: string; house: number } | null;
    otherPlanetsThere: string[];
  }>;
};

const MAX_CONTACTS = 16;

/** Planets that carry relationships between two people in any reading. */
const KEY_PLANETS = new Set(["ศุกร์", "อังคาร", "จันทร์", "อาทิตย์", "พฤหัสบดี"]);

function valid(sign: string | null | undefined): string | null {
  if (!sign) return null;
  const s = normalizeSignName(sign);
  return (SIGNS as readonly string[]).includes(s) ? s : null;
}

function rows(planets: PlanetSignRow[]): Array<{ planet: string; sign: string }> {
  return planets.flatMap((p) => {
    const sign = valid(p.siderealSign);
    return sign ? [{ planet: p.planet, sign }] : [];
  });
}

function signOfHouse(lagna: string, house: number): string {
  return SIGNS[((SIGNS as readonly string[]).indexOf(lagna) + house - 1) % 12]!;
}

export function computeSynastry(
  user: ChartSide,
  other: ChartSide,
  relationHouses: number[],
): Synastry {
  const uLagna = valid(user.lagna);
  const oLagna = valid(other.lagna);
  const u = rows(user.planets);
  const o = rows(other.planets);

  const lagnaRelation =
    uLagna && oLagna
      ? {
          kind: aspectKindFromHouse(houseFromSign(uLagna, oLagna)),
          house: houseFromSign(uLagna, oLagna),
        }
      : null;

  const place = (lagna: string | null, list: typeof o): Placement[] =>
    lagna ? list.map((p) => ({ ...p, house: houseFromSign(lagna, p.sign) })) : [];

  const relationLords = new Set(
    uLagna ? relationHouses.map((h) => lordOfSign(signOfHouse(uLagna, h))).filter(Boolean) : [],
  );

  // A real pair of charts produced 42 contacts — more than a reader or the
  // model can weigh. Keep what carries a relationship: any planet sitting on or
  // facing a key planet or a relationship lord, and trines and squares only
  // between two such planets. เกตุ laps the zodiac in the Thai system; left out.
  const carries = (planet: string) =>
    KEY_PLANETS.has(planet) || relationLords.has(planet);
  const contacts: CrossContact[] = [];
  for (const a of u) {
    for (const b of o) {
      if (a.planet === "เกตุ" || b.planet === "เกตุ") continue;
      const kind = aspectKindFromHouse(houseFromSign(a.sign, b.sign));
      if (!kind) continue;
      const strong = kind === "กุม" || kind === "เล็ง";
      const keep = strong
        ? carries(a.planet) || carries(b.planet)
        : carries(a.planet) && carries(b.planet);
      if (!keep) continue;
      const e1 = elementOf(a.planet);
      const e2 = elementOf(b.planet);
      contacts.push({
        kind,
        userPlanet: a.planet,
        otherPlanet: b.planet,
        elements: e1 && e2 ? `${e1}–${e2}` : null,
        sameElement: Boolean(e1 && e2 && e1 === e2),
      });
    }
  }

  const KIND_ORDER: AspectKind[] = ["กุม", "เล็ง", "ตรีโกณ", "จตุโกณ"];
  const weight = (c: CrossContact) =>
    (relationLords.has(c.userPlanet) ? 2 : 0) +
    (["ศุกร์", "จันทร์", "อังคาร"].includes(c.userPlanet) ? 1 : 0) +
    (["ศุกร์", "จันทร์", "อังคาร"].includes(c.otherPlanet) ? 1 : 0);
  contacts.sort(
    (x, y) =>
      KIND_ORDER.indexOf(x.kind) - KIND_ORDER.indexOf(y.kind) || weight(y) - weight(x),
  );
  contacts.splice(MAX_CONTACTS);

  return {
    lagnaRelation,
    otherInUserHouses: place(uLagna, o),
    userInOtherHouses: place(oLagna, u),
    contacts,
    relationHouses: uLagna
      ? relationHouses.map((house) => {
          const sign = signOfHouse(uLagna, house);
          const lord = lordOfSign(sign);
          const lordRow = u.find((p) => p.planet === lord);
          return {
            house,
            lord,
            lordAt: lordRow ? { sign: lordRow.sign, house: houseFromSign(uLagna, lordRow.sign) } : null,
            otherPlanetsThere: o.filter((p) => p.sign === sign).map((p) => p.planet),
          };
        })
      : [],
  };
}

const houseName = (h: number) => `ภพ ${h} ${HOUSE_NAMES[h - 1] ?? ""}`.trim();

/** The other person's own chart, compact. */
export function formatCompanionChart(
  index: number,
  label: string,
  weekday: string | null,
  side: ChartSide,
): string[] {
  const lagna = valid(side.lagna);
  const head =
    `[companion_${index}] ดวงของ ${label}` +
    (weekday ? ` · เกิดวัน${weekday}` : "") +
    (lagna
      ? ` · ลัคนาราศี${lagna}`
      : " · ไม่ทราบเวลาเกิด — ห้ามพูดถึงลัคนาและภพของคนนี้ ใช้ได้แค่ราศีของดาว");
  const planets = rows(side.planets).map((p) => {
    const dignity = dignityLabel(p.planet, p.sign);
    const where = lagna ? ` ${houseName(houseFromSign(lagna, p.sign))}` : "";
    return `${p.planet} ราศี${p.sign}${where}${dignity !== "ปกติ" && dignity !== "—" ? ` (${dignity})` : ""}`;
  });
  return [head, `- ดาว: ${planets.join(" · ")}`];
}

/** What connects the two charts. */
export function formatSynastryForPrompt(
  index: number,
  label: string,
  s: Synastry,
  name = label,
): string[] {
  const lines = [
    `[synastry_${index}] ดวงของผู้ถามกับ${label} (คำนวณแล้ว ห้ามเดา — วิเคราะห์ความเข้ากันจากบล็อกนี้):`,
  ];
  label = name;
  if (s.lagnaRelation) {
    lines.push(
      `- ลัคนาสองคน: ลัคนาของ${label}อยู่${houseName(s.lagnaRelation.house)} ของผู้ถาม` +
        (s.lagnaRelation.kind ? ` · ${s.lagnaRelation.kind}กัน` : " · ไม่ทำมุมกัน"),
    );
  }
  if (s.relationHouses.length) {
    lines.push(
      "- ภพที่ใช้ดูความสัมพันธ์นี้ในดวงผู้ถาม: " +
        s.relationHouses
          .map((r) => {
            const lord = r.lord && r.lordAt ? `เจ้าเรือน${r.lord}ไปอยู่${houseName(r.lordAt.house)}` : "";
            const there = r.otherPlanetsThere.length ? ` · ดาวของ${label}ที่ตกภพนี้: ${r.otherPlanetsThere.join(" ")}` : "";
            return `${houseName(r.house)}${lord ? ` (${lord})` : ""}${there}`;
          })
          .join(" | "),
    );
  }
  if (s.otherInUserHouses.length) {
    lines.push(
      `- ดาวของ${label}ตกภพไหนของผู้ถาม: ` +
        s.otherInUserHouses.map((p) => `${p.planet}→${houseName(p.house)}`).join(" · "),
    );
  }
  if (s.userInOtherHouses.length) {
    lines.push(
      `- ดาวของผู้ถามตกภพไหนของ${label}: ` +
        s.userInOtherHouses.map((p) => `${p.planet}→${houseName(p.house)}`).join(" · "),
    );
  }
  lines.push(
    s.contacts.length
      ? `- ดาวข้ามดวงที่ทำมุมกัน (ดาวผู้ถาม–ดาว${label}): ` +
          s.contacts
            .map(
              (c) =>
                `${c.userPlanet}–${c.otherPlanet} ${c.kind}` +
                (c.elements ? (c.sameElement ? ` (คู่ธาตุ${c.elements.split("–")[0]})` : ` (ธาตุ${c.elements})`) : ""),
            )
            .join(" · ")
      : "- ดาวข้ามดวง: ไม่มีคู่ที่กุมหรือเล็งกัน",
  );
  return lines;
}
