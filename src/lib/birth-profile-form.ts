import {
  BUDDHIST_YEAR_OFFSET,
  getDisplayDateParts,
} from "@/lib/date";

export type BirthFormInitialValues = {
  day: string;
  month: number;
  era: "BE" | "CE";
  year: string;
  hour: string;
  minute: string;
  country: string;
  province: string;
  district: string;
};

export type StoredBirthProfile = {
  birthDate: string | Date;
  birthTime: string | null;
  birthTimeKnown: boolean;
  birthCountry: string | null;
  birthProvince: string | null;
  birthDistrict: string | null;
};

/** Convert the stored UTC instant back to the Thai wall-clock form values. */
export function birthProfileToFormValues(
  profile: StoredBirthProfile,
): BirthFormInitialValues {
  const birthDate =
    profile.birthDate instanceof Date
      ? profile.birthDate
      : new Date(profile.birthDate);
  const date = getDisplayDateParts(birthDate);
  const [storedHour = "", storedMinute = ""] =
    profile.birthTimeKnown && profile.birthTime
      ? profile.birthTime.split(":")
      : [];

  return {
    day: String(date.day),
    month: date.month,
    era: "BE",
    year: Number.isFinite(date.year)
      ? String(date.year + BUDDHIST_YEAR_OFFSET)
      : "",
    hour: storedHour ? String(Number(storedHour)) : "",
    minute: storedMinute ? String(Number(storedMinute)) : "",
    country: profile.birthCountry?.trim() || "ไทย",
    province: profile.birthProvince?.trim() || "",
    district: profile.birthDistrict?.trim() || "",
  };
}
