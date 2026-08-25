import { DISTRICTS, PROVINCES } from "@/data/thailand-geo";

export type ReverseAddressFields = Record<string, unknown>;

export type MatchedThaiAddress = {
  province: string;
  district: string;
  areaLabel: string;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function compactThaiPlace(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/^(?:จังหวัด|จ\.|อำเภอ|อ\.|เขต|แขวง|ตำบล|ต\.)\s*/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findCanonical(
  candidates: string[],
  canonical: readonly string[],
  opts?: { rejectIfEquals?: string },
): string {
  const rejected = compactThaiPlace(opts?.rejectIfEquals ?? "");
  const longest = (matches: string[]) =>
    matches.sort((a, b) => b.length - a.length)[0] ?? "";

  for (const raw of candidates) {
    const candidate = compactThaiPlace(raw);
    if (!candidate || candidate === rejected) continue;
    const exact = canonical.find(
      (item) => compactThaiPlace(item) === candidate,
    );
    if (exact) return exact;
  }
  for (const raw of candidates) {
    const candidate = compactThaiPlace(raw);
    if (!candidate || candidate === rejected) continue;
    // Longest match only — "กรุงเทพมหานคร".includes("พระนคร") used to
    // stamp every Bangkok GPS fix as เขตพระนคร.
    const contained = canonical.filter((item) => {
      const name = compactThaiPlace(item);
      if (name.length < 3) return false;
      if (rejected && rejected.includes(name) && candidate === rejected) {
        return false;
      }
      return candidate.includes(name) || name.includes(candidate);
    });
    const best = longest(contained);
    if (best) return best;
  }
  return "";
}

/** Convert flexible OSM address fields to our canonical Thai dropdown values. */
export function matchThaiReverseAddress(
  fields: ReverseAddressFields,
): MatchedThaiAddress | null {
  const countryCode = text(fields.country_code).toLowerCase();
  if (countryCode && countryCode !== "th") return null;

  const provinceCandidates = [
    text(fields.state),
    text(fields.province),
    text(fields.region),
    text(fields.city),
  ];
  if (provinceCandidates.some((value) => /กรุงเทพ|bangkok/i.test(value))) {
    provinceCandidates.unshift("กรุงเทพมหานคร");
  }
  const province = findCanonical(provinceCandidates, PROVINCES);
  if (!province) return null;

  const districtCandidates = [
    text(fields.city_district),
    text(fields.district),
    text(fields.county),
    text(fields.municipality),
    text(fields.suburb),
    text(fields.town),
    text(fields.city),
  ];
  const district = findCanonical(
    districtCandidates,
    DISTRICTS[province] ?? [],
    { rejectIfEquals: province },
  );
  const subdistrict = compactThaiPlace(
    text(fields.quarter) ||
      text(fields.neighbourhood) ||
      text(fields.village) ||
      text(fields.suburb),
  );
  const pieces = [subdistrict, district, province].filter(
    (value, index, all) => value && all.indexOf(value) === index,
  );

  return {
    province,
    district,
    areaLabel: pieces.join(" · "),
  };
}

/** Customer-facing + AI place line. Bangkok uses เขต, others อำเภอ. */
export function formatThaiLocationLine(input: {
  district?: string | null;
  province?: string | null;
  country?: string | null;
}): string {
  const province = compactThaiPlace(input.province ?? "");
  const rawDistrict = compactThaiPlace(input.district ?? "");
  const district = rawDistrict === "_default" ? "" : rawDistrict;
  const bangkok = /กรุงเทพ/.test(province);
  const parts: string[] = [];
  if (district) {
    parts.push(bangkok ? `เขต${district}` : `อำเภอ${district}`);
  }
  if (province) {
    parts.push(bangkok ? "กรุงเทพมหานคร" : `จังหวัด${province}`);
  }
  const country = compactThaiPlace(input.country ?? "");
  if (country && country !== "ไทย" && country !== "Thailand") {
    parts.push(country);
  }
  return parts.join(" ");
}
