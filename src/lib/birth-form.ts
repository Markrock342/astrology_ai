import {
  BUDDHIST_YEAR_OFFSET,
  type YearEra,
} from "@/lib/date";
import { DISPLAY_TIMEZONE } from "@/config/constants";

export const THAI_BIRTH_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
] as const;

export type BirthFormInitial = {
  day: string;
  month: string;
  year: string;
  era: YearEra;
  hour: string;
  minute: string;
  country: string;
  province: string;
  district: string;
};

function bangkokDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: DISPLAY_TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  return {
    day: get("day"),
    month: Number(get("month")),
    yearCe: Number(get("year")),
    hour: get("hour"),
    minute: get("minute"),
  };
}

/** Map a stored birth profile row into birth-form field defaults (Bangkok time). */
export function birthProfileToFormInitial(profile: {
  birthDate: Date;
  birthTime: string | null;
  birthTimeKnown: boolean;
  birthCountry: string | null;
  birthProvince: string | null;
  birthDistrict: string | null;
}): BirthFormInitial {
  const { day, month, yearCe, hour, minute } = bangkokDateParts(profile.birthDate);
  const timeMatch = profile.birthTime?.match(/^(\d{1,2}):(\d{1,2})/);

  return {
    day,
    month: THAI_BIRTH_MONTHS[month - 1] ?? "",
    year: String(yearCe + BUDDHIST_YEAR_OFFSET),
    era: "BE",
    hour:
      profile.birthTimeKnown && timeMatch
        ? timeMatch[1].padStart(2, "0")
        : hour.padStart(2, "0"),
    minute:
      profile.birthTimeKnown && timeMatch
        ? timeMatch[2].padStart(2, "0")
        : minute.padStart(2, "0"),
    country: profile.birthCountry?.trim() || "ไทย",
    province: profile.birthProvince?.trim() || "",
    district: profile.birthDistrict?.trim() || "",
  };
}

export function thaiMonthToNumber(month: string): number {
  const idx = THAI_BIRTH_MONTHS.indexOf(month as (typeof THAI_BIRTH_MONTHS)[number]);
  return idx >= 0 ? idx + 1 : 0;
}
