import provinceIds from "./myhora-province-ids.json";
import bangkokAmphurIds from "./myhora-bangkok-amphur-ids.json";

/**
 * myhora's thai.aspx dropdowns post NUMERIC ids (dd_province=57 for สกลนคร,
 * dd_amphur=40 for เขตพระนคร) — not Thai names. Posting a name that is not in
 * the list leaves the ASP.NET DropDownList on its default (กรุงเทพฯ / พระนคร),
 * so the ascendant was computed for Bangkok regardless of the birthplace.
 *
 * Province ids are static (77, alphabetical). District ids are only known
 * after a province-change postback (the page rebinds dd_amphur), except
 * Bangkok's 50 เขต which the landing page already carries.
 */
export const MYHORA_PROVINCE_IDS = provinceIds as Record<string, string>;
const BANGKOK_AMPHUR_IDS = bangkokAmphurIds as Record<string, string>;
export const MYHORA_BANGKOK_PROVINCE_ID = "1";

export type MyhoraPlaceIds = {
  province?: string;
  amphur?: string;
  province2?: string;
  amphur2?: string;
};

export function normalizeDistrictLabel(label: string): string {
  return label
    .replace(/^\s*(เขต|กิ่งอำเภอ|อำเภอ|อ\.)\s*/, "")
    .replace(/\s+/g, "")
    .trim();
}

/** Pick the option id whose label names `district` (prefixes เขต/อ. ignored). */
export function findDistrictId(
  options: Record<string, string>,
  district: string,
): string | undefined {
  const want = normalizeDistrictLabel(district);
  if (!want) return undefined;
  for (const [label, id] of Object.entries(options)) {
    if (normalizeDistrictLabel(label) === want) return id;
  }
  const loose = Object.entries(options).filter(([label]) => {
    const have = normalizeDistrictLabel(label);
    return have.includes(want) || want.includes(have);
  });
  return loose.length === 1 ? loose[0]![1] : undefined;
}

export function bangkokDistrictId(district: string): string | undefined {
  return findDistrictId(BANGKOK_AMPHUR_IDS, district);
}

/** `label → id` for a `<select name="dd_amphur">` (or dd_amphur2) in page/delta HTML. */
export function parseAmphurOptions(
  html: string,
  selectName: "dd_amphur" | "dd_amphur2" = "dd_amphur",
): Record<string, string> | null {
  const block = html.match(
    new RegExp(`<select[^>]*name="${selectName}"[^>]*>([\\s\\S]*?)</select>`),
  )?.[1];
  if (!block) return null;
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/<option[^>]*value="([^"]*)"[^>]*>([^<]*)</g)) {
    const label = m[2]!.trim();
    if (label) out[label] = m[1]!;
  }
  return Object.keys(out).length ? out : null;
}

/**
 * ASP.NET UpdatePanel partial-postback responses carry the new view state as
 * `|hiddenField|__VIEWSTATE|<value>|`. The final submit must use it: it is
 * the view state in which dd_amphur holds the chosen province's districts.
 */
export function parseDeltaViewState(text: string): {
  viewState?: string;
  generator?: string;
} {
  return {
    viewState: text.match(/\|hiddenField\|__VIEWSTATE\|([^|]*)\|/)?.[1],
    generator: text.match(/\|hiddenField\|__VIEWSTATEGENERATOR\|([^|]*)\|/)?.[1],
  };
}
