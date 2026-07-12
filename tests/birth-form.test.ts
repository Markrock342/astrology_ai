import { describe, expect, it } from "vitest";
import { buildBirthDateUtc } from "@/lib/date";
import { birthProfileToFormInitial } from "@/lib/birth-form";

describe("birthProfileToFormInitial", () => {
  it("round-trips Bangkok birth date/time into form defaults", () => {
    const birthDate = buildBirthDateUtc({
      year: 2533,
      month: 1,
      day: 15,
      hour: 12,
      minute: 30,
      era: "BE",
    });

    const initial = birthProfileToFormInitial({
      birthDate,
      birthTime: "12:30",
      birthTimeKnown: true,
      birthCountry: "ไทย",
      birthProvince: "กรุงเทพมหานคร",
      birthDistrict: "พระนคร",
    });

    expect(initial).toMatchObject({
      day: "15",
      month: "มกราคม",
      year: "2533",
      era: "BE",
      hour: "12",
      minute: "30",
      country: "ไทย",
      province: "กรุงเทพมหานคร",
      district: "พระนคร",
    });
  });
});
