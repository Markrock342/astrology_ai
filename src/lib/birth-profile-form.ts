import {
  BUDDHIST_YEAR_OFFSET,
  getDisplayDateParts,
} from "@/lib/date";

export type BirthFormInitialValues = {
  day: string;
  month: number;
  era: "BE" | "CE";
  year: string;
  birthTimeKnown: boolean;
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
  // Unknown time uses the same noon convention as the create path checkbox.
  const [storedHour = "12", storedMinute = "0"] =
    profile.birthTimeKnown && profile.birthTime
      ? profile.birthTime.split(":")
      : ["12", "0"];

  return {
    day: String(date.day),
    month: date.month,
    era: "BE",
    year: Number.isFinite(date.year)
      ? String(date.year + BUDDHIST_YEAR_OFFSET)
      : "",
    birthTimeKnown: profile.birthTimeKnown,
    hour: String(Number(storedHour)),
    minute: String(Number(storedMinute)),
    country: profile.birthCountry?.trim() || "ไทย",
    province: profile.birthProvince?.trim() || "",
    district: profile.birthDistrict?.trim() || "",
  };
}
