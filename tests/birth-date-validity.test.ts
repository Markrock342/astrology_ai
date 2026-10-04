import { describe, expect, it } from "vitest";
import { birthProfileSchema } from "@/lib/schemas";

const base = { birthTimeKnown: false, birthCountry: "ไทย", birthProvince: "กรุงเทพมหานคร", birthDistrict: "พระนคร" };

describe("birth dates that do not exist", () => {
  it.each([
    [{ year: 1990, month: 2, day: 31, yearEra: "CE" }],
    [{ year: 2533, month: 2, day: 30, yearEra: "BE" }],
    [{ year: 2023, month: 4, day: 31, yearEra: "CE" }],
    [{ year: 2099, month: 1, day: 1, yearEra: "CE" }],
  ])("%o is refused", (d) => {
    expect(birthProfileSchema.safeParse({ ...base, ...d }).success).toBe(false);
  });

  it.each([
    [{ year: 1988, month: 2, day: 29, yearEra: "CE" }],
    [{ year: 2544, month: 11, day: 18, yearEra: "BE" }],
    [{ year: 2544, month: 11, day: 18 }],
  ])("%o is accepted", (d) => {
    expect(birthProfileSchema.safeParse({ ...base, ...d }).success).toBe(true);
  });
});
