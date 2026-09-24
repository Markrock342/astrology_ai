import type { PlanetSignRow } from "@/types/chart";
import {
  aspectKindFromHouse,
  houseFromSign,
  type AspectKind,
} from "@/lib/chart-aspects";
import {
  HOUSE_MEANING,
  HOUSE_NAMES,
  normalizeSignName,
  SIGNS,
} from "@/lib/chart-theme";

/**
 * Where each moving planet lands in THIS person's chart.
 *
 * A transit reading in Thai astrology is not "Saturn is in Pisces"; it is
 * "Saturn is walking through your 6th house and sitting on your natal Venus".
 * Left to the model, that synthesis happened only when someone asked for it in
 * the chat — so it is computed here, deterministically, and handed over as
 * facts the answer has to use.
 */
export type TransitNatalContact = { kind: AspectKind; natalBody: string };

export type TransitNatalLink = {
  transitPlanet: string;
  transitSign: string;
  /** Whole-sign house counted from the NATAL lagna; 0 when the lagna is unknown. */
  natalHouse: number;
  natalHouseName: string | null;
  contacts: TransitNatalContact[];
};

/**
 * Slow movers first: they are what defines a period. The Moon changes sign
 * every two and a half days, so it goes last.
 */
const PERIOD_WEIGHT = [
  "เสาร์",
  "ราหู",
  "เกตุ",
  "พฤหัสบดี",
  "พฤหัส",
  "มฤตยู",
  "อังคาร",
  "อาทิตย์",
  "ศุกร์",
  "พุธ",
  "จันทร์",
];

function validSign(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const sign = normalizeSignName(raw);
  return (SIGNS as readonly string[]).includes(sign) ? sign : null;
}

function weight(planet: string): number {
  const idx = PERIOD_WEIGHT.indexOf(planet);
  return idx >= 0 ? idx : PERIOD_WEIGHT.length;
}

export function linkTransitToNatal(input: {
  natalLagna: string | null | undefined;
  natalPlanets: PlanetSignRow[];
  transitPlanets: PlanetSignRow[];
}): TransitNatalLink[] {
  const lagna = validSign(input.natalLagna);
  const natalBodies: Array<{ name: string; sign: string }> = [];
  if (lagna) natalBodies.push({ name: "ลัคนา", sign: lagna });
  for (const row of input.natalPlanets) {
    const sign = validSign(row.siderealSign);
    if (sign) natalBodies.push({ name: row.planet, sign });
  }

  const links: TransitNatalLink[] = [];
  for (const row of input.transitPlanets) {
    const sign = validSign(row.siderealSign);
    if (!sign) continue;
    const natalHouse = lagna ? houseFromSign(lagna, sign) : 0;
    const contacts: TransitNatalContact[] = [];
    for (const body of natalBodies) {
      const kind = aspectKindFromHouse(houseFromSign(sign, body.sign));
      if (kind) contacts.push({ kind, natalBody: body.name });
    }
    links.push({
      transitPlanet: row.planet,
      transitSign: sign,
      natalHouse,
      natalHouseName: natalHouse ? HOUSE_NAMES[natalHouse - 1] ?? null : null,
      contacts,
    });
  }
  return links.sort((a, b) => weight(a.transitPlanet) - weight(b.transitPlanet));
}

const CONTACT_ORDER: AspectKind[] = ["กุม", "เล็ง", "ตรีโกณ", "จตุโกณ"];

export function formatTransitToNatalForPrompt(
  links: TransitNatalLink[],
  opts: { horizon?: boolean } = {},
): string[] {
  const tag = opts.horizon ? "[transit_horizon_to_natal]" : "[transit_to_natal]";
  const when = opts.horizon ? "ดาวจรปลายช่วง" : "ดาวจร";
  const lines = [
    `${tag} ${when}กระทบพื้นดวงของผู้ถามตรงไหน ` +
      "(คำนวณจาก [natal] กับ [transit] แล้ว ห้ามเดา — คำตอบเรื่องช่วงเวลาต้องอ่านจากบล็อกนี้):",
  ];
  if (!links.length) {
    lines.push("- ไม่มีข้อมูลดาวจรที่ใช้ได้");
    return lines;
  }
  for (const link of links) {
    const where = link.natalHouseName
      ? `เดินในเรือน ${link.natalHouse} ${link.natalHouseName} ของพื้นดวง (${HOUSE_MEANING[link.natalHouseName as (typeof HOUSE_NAMES)[number]]})`
      : "ไม่ทราบเรือนเพราะไม่มีลัคนาเดิม";
    const contacts = [...link.contacts]
      .sort((a, b) => CONTACT_ORDER.indexOf(a.kind) - CONTACT_ORDER.indexOf(b.kind))
      .map((c) => `${c.kind}${c.natalBody === "ลัคนา" ? "ลัคนาเดิม" : `${c.natalBody}เดิม`}`);
    lines.push(
      `- ${link.transitPlanet}จร ราศี${link.transitSign} · ${where}` +
        (contacts.length ? ` · ${contacts.join(" · ")}` : " · ไม่ทำมุมกับดาวเดิม"),
    );
  }
  return lines;
}
