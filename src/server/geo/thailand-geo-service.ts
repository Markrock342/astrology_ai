import { COUNTRIES, DISTRICTS, PROVINCES } from "@/data/thailand-geo";

export type ThailandGeo = {
  countries: string[];
  provinces: string[];
  districts: Record<string, string[]>;
};

/** Full dataset for birth-profile dropdowns (M2 contract). */
export function getThailandGeo(): ThailandGeo {
  return { countries: COUNTRIES, provinces: PROVINCES, districts: DISTRICTS };
}

/** Districts for a province; empty array when the province has no district data yet. */
export function getDistrictsForProvince(province: string): string[] {
  return DISTRICTS[province] ?? [];
}
