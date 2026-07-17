import { describe, expect, it } from "vitest";
import { birthProfileToFormValues } from "@/lib/birth-profile-form";

describe("birthProfileToFormValues", () => {
  it("prefills the Thai birth form from the stored UTC profile", () => {
    expect(
      birthProfileToFormValues({
        // 18 Nov 2001, 02:04 in Asia/Bangkok.
        birthDate: "2001-11-17T19:04:00.000Z",
        birthTime: "02:04",
        birthTimeKnown: true,
        birthCountry: "ไทย",
        birthProvince: "นครราชสีมา",
        birthDistrict: "โชคชัย",
      }),
    ).toEqual({
      day: "18",
      month: 11,
      era: "BE",
      year: "2544",
      hour: "2",
      minute: "4",
      country: "ไทย",
      province: "นครราชสีมา",
      district: "โชคชัย",
    });
  });

  it("keeps unknown time empty and applies safe location defaults", () => {
    const values = birthProfileToFormValues({
      birthDate: new Date("1990-01-15T17:00:00.000Z"),
      birthTime: null,
      birthTimeKnown: false,
      birthCountry: null,
      birthProvince: null,
      birthDistrict: null,
    });

    expect(values).toMatchObject({
      day: "16",
      month: 1,
      year: "2533",
      hour: "",
      minute: "",
      country: "ไทย",
      province: "",
      district: "",
    });
  });
});
