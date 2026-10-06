import { HOUSE_NAMES } from "@/lib/chart-theme";
import type { HouseChain } from "@/lib/house-chains";

/**
 * Checks an answer's house-lord claims against the chart. The lords are in
 * the prompt, yet an answer for a กันย์ lagna named พฤหัสบดี "เจ้าเรือนกัมมะ"
 * (it is พุธ). Used by the reading trace and the answer test suite.
 */
export type LordClaimIssue = {
  house: number;
  houseName: string;
  claimed: string;
  actual: string;
  excerpt: string;
};

const PLANETS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "พฤหัส", "ศุกร์", "เสาร์", "ราหู", "เกตุ", "มฤตยู"];
const canon = (p: string) => (p === "พฤหัส" ? "พฤหัสบดี" : p);
// Thai reckoning gives กุมภ์ to ราหู as well as เสาร์.
const alsoLord = (actual: string, claimed: string, sign: string) =>
  sign.replace(/์/g, "") === "กุมภ" && actual === "เสาร์" && claimed === "ราหู";

export function findWrongLordClaims(answer: string, chains: HouseChain[]): LordClaimIssue[] {
  const lordOf = new Map<number, { lord: string; sign: string }>();
  for (const chain of chains) {
    const first = chain.steps[0];
    if (first) lordOf.set(chain.startHouse, { lord: first.lord, sign: first.sign });
  }
  if (!lordOf.size) return [];

  const planetAlt = PLANETS.join("|");
  const houseAlt = HOUSE_NAMES.join("|");
  const issues: LordClaimIssue[] = [];
  const check = (houseName: string, claimedRaw: string, excerpt: string) => {
    const house = HOUSE_NAMES.indexOf(houseName as (typeof HOUSE_NAMES)[number]) + 1;
    const truth = lordOf.get(house);
    const claimed = canon(claimedRaw);
    if (!truth || truth.lord === claimed || alsoLord(truth.lord, claimed, truth.sign)) return;
    issues.push({ house, houseName, claimed, actual: truth.lord, excerpt: excerpt.trim() });
  };

  // "พฤหัสบดี (๕) ซึ่งเป็นดาวเจ้าเรือนกัมมะ" — the planet named just before.
  const before = new RegExp(`(${planetAlt})(?:\\s*\\([๐-๙0-9]\\))?(?:เดิม|จร)?\\s*(?:ซึ่ง|ที่)?(?:เป็น)?(?:ดาว)?\\s*เจ้าเรือน\\s*(?:ภพ\\s*)?(${houseAlt})`, "g");
  for (const m of answer.matchAll(before)) check(m[2]!, m[1]!, m[0]);
  // "เจ้าเรือนกัมมะคือดาวพุธ" / "เจ้าเรือนกัมมะ (พุธ)".
  const after = new RegExp(`เจ้าเรือน\\s*(?:ภพ\\s*)?(${houseAlt})(?:\\s*\\([^)]{0,30}\\))?\\s*(?:คือ|หรือ|ได้แก่|ซึ่งก็คือ|\\()\\s*(?:ดาว)?(${planetAlt})`, "g");
  for (const m of answer.matchAll(after)) check(m[1]!, m[2]!, m[0]);

  const seen = new Set<string>();
  return issues.filter((i) => {
    const key = `${i.house}:${i.claimed}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * "พฤหัสบดีเป็นศรีจร" when this year's ศรีจร is ราหู. Graders found the same
 * person's answers giving different ทักษาจร — made-up facts. Checked against
 * the computed ทักษาจร for the period asked about.
 */
export type TaksaClaimIssue = { planet: string; claimed: string; actual: string; excerpt: string };

const ROLES = ["ศรี", "มนตรี", "เดช", "บริวาร", "อายุ", "อุตสาหะ", "มูละ", "กาลกิณี"];

export function findWrongTaksaClaims(
  answer: string,
  slots: Array<{ planet: string; taksa: string }>,
): TaksaClaimIssue[] {
  const roleOf = new Map(slots.filter((s) => s.planet).map((s) => [s.planet, s.taksa.replace(/จร$/, "")]));
  if (!roleOf.size) return [];
  const planetAlt = PLANETS.join("|");
  const re = new RegExp(
    `(${planetAlt})(?:จร)?\\s*(?:\\([๐-๙0-9]\\))?\\s*(?:ซึ่ง|ที่)?\\s*(?:เป็น|ได้ตำแหน่ง|รับตำแหน่ง|ติด)?\\s*(?:ดาว)?(${ROLES.join("|")})จร`,
    "g",
  );
  const out: TaksaClaimIssue[] = [];
  const seen = new Set<string>();
  for (const m of answer.matchAll(re)) {
    const planet = canon(m[1]!);
    const actual = roleOf.get(planet);
    if (!actual || actual === m[2]) continue;
    const key = `${planet}:${m[2]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ planet, claimed: `${m[2]}จร`, actual: `${actual}จร`, excerpt: m[0] });
  }
  return out;
}

