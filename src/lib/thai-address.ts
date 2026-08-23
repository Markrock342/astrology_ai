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
): string {
  for (const raw of candidates) {
    const candidate = compactThaiPlace(raw);
    if (!candidate) continue;
    const exact = canonical.find(
      (item) => compactThaiPlace(item) === candidate,
    );
    if (exact) return exact;
  }
  for (const raw of candidates) {
    const candidate = compactThaiPlace(raw);
    if (!candidate) continue;
    const contained = canonical.find((item) =>
      candidate.includes(compactThaiPlace(item)),
    );
    if (contained) return contained;
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
