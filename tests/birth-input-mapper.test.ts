import type { BirthProfile } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  birthProfileToChartInput,
  chartInputMatches,
} from "@/server/horoscope/engine/birth-input-mapper";

const profile: BirthProfile = {
  id: "profile-1",
  userId: "user-1",
  nickname: null,
  // User entered 18/11/2001 02:04 in Thailand.
  birthDate: new Date("2001-11-17T19:04:00.000Z"),
  birthTime: "02:04",
  birthTimeKnown: true,
  gender: null,
  birthCountry: "ไทย",
  birthProvince: "นครราชสีมา",
  birthDistrict: "โชคชัย",
  birthLocation: "โชคชัย, นครราชสีมา, ไทย",
  additionalInfo: null,
  consentVersion: null,
  editCount: 0,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("birthProfileToChartInput", () => {
  it("uses the Thai civil date instead of the previous UTC date", () => {
    expect(birthProfileToChartInput(profile)).toEqual({
      day: 18,
      month: 11,
      year: 2001,
      time: "02:04",
      country: "ไทย",
      province: "นครราชสีมา",
      district: "โชคชัย",
    });
  });

  it("marks a cached chart with the old UTC date as stale", () => {
    const expected = birthProfileToChartInput(profile);
    expect(chartInputMatches({ ...expected, day: 17 }, expected)).toBe(false);
    expect(chartInputMatches(expected, expected)).toBe(true);
  });
});
