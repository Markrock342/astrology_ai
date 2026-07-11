import type { BirthProfile } from "@prisma/client";
import type { BirthInputSnapshot } from "@/types/chart";

/** Map DB birth profile → newhora BirthInput (Gregorian date, Thai location). */
export function birthProfileToChartInput(profile: BirthProfile): BirthInputSnapshot {
  const d = profile.birthDate;
  const time =
    profile.birthTimeKnown && profile.birthTime
      ? profile.birthTime
      : "12:00";

  return {
    day: d.getUTCDate(),
    month: d.getUTCMonth() + 1,
    year: d.getUTCFullYear(),
    time,
    country: profile.birthCountry || "ไทย",
    province: profile.birthProvince ?? profile.birthLocation ?? "กรุงเทพมหานคร",
    district: profile.birthDistrict ?? "_default",
  };
}
