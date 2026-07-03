import { describe, expect, it } from "vitest";
import {
  BUDDHIST_YEAR_OFFSET,
  buildBirthDateUtc,
  toGregorianYear,
} from "@/lib/date";

describe("toGregorianYear", () => {
  it("returns CE year unchanged when era is CE", () => {
    expect(toGregorianYear(1990, "CE")).toBe(1990);
  });

  it("subtracts Buddhist offset when era is BE", () => {
    expect(toGregorianYear(2533, "BE")).toBe(2533 - BUDDHIST_YEAR_OFFSET);
  });

  it("treats year >= 2200 as Buddhist when era is omitted", () => {
    expect(toGregorianYear(2567)).toBe(2567 - BUDDHIST_YEAR_OFFSET);
  });

  it("treats plausible Gregorian years as CE when era is omitted", () => {
    expect(toGregorianYear(1990)).toBe(1990);
  });
});

describe("buildBirthDateUtc", () => {
  it("stores Bangkok wall-clock as UTC (UTC+7)", () => {
    const date = buildBirthDateUtc({
      year: 2533,
      month: 1,
      day: 15,
      hour: 12,
      minute: 30,
      era: "BE",
    });
    expect(date.toISOString()).toBe("1990-01-15T05:30:00.000Z");
  });

  it("uses midnight Bangkok when birth time is unknown", () => {
    const date = buildBirthDateUtc({ year: 1990, month: 6, day: 1, era: "CE" });
    expect(date.toISOString()).toBe("1990-05-31T17:00:00.000Z");
  });
});
