import type { BirthProfile } from "@prisma/client";
import type { BirthInputSnapshot } from "@/types/chart";
import { getDisplayDateParts } from "@/lib/date";

/** Map DB birth profile → newhora BirthInput (Gregorian date, Thai location). */
export function birthProfileToChartInput(profile: BirthProfile): BirthInputSnapshot {
  const date = getDisplayDateParts(profile.birthDate);
  const time =
    profile.birthTimeKnown && profile.birthTime
      ? profile.birthTime
      : "12:00";

  return {
    day: date.day,
    month: date.month,
    year: date.year,
    time,
    country: profile.birthCountry || "ไทย",
    province: profile.birthProvince ?? profile.birthLocation ?? "กรุงเทพมหานคร",
    district: profile.birthDistrict ?? "_default",
  };
}

/** Detect cached charts produced from a different profile or old timezone mapping. */
export function chartInputMatches(
  actual: BirthInputSnapshot | null | undefined,
  expected: BirthInputSnapshot,
): boolean {
  if (!actual) return false;
  return (
    actual.day === expected.day &&
    actual.month === expected.month &&
    actual.year === expected.year &&
    actual.time === expected.time &&
    actual.country === expected.country &&
    actual.province === expected.province &&
    actual.district === expected.district
  );
}
