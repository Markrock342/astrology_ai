import { describe, expect, it } from "vitest";
import { buildMyhoraFormBody } from "@/server/horoscope/engine/myhora/fetch-myhora";
import type { BirthInputSnapshot } from "@/types/chart";

const natal: BirthInputSnapshot = {
  day: 15,
  month: 1,
  year: 1990,
  time: "08:30",
  country: "ไทย",
  province: "กรุงเทพมหานคร",
  district: "พระนคร",
};

describe("buildMyhoraFormBody transit place", () => {
  it("uses transit province/district for dd_province2/dd_amphur2", () => {
    const body = buildMyhoraFormBody(
      natal,
      "vs",
      "gen",
      "asc",
      {
        day: 2,
        month: 9,
        year: 2026,
        time: "14:22",
        province: "เชียงใหม่",
        district: "เมืองเชียงใหม่",
      },
    );

    expect(body.get("dd_province")).toBe("กรุงเทพมหานคร");
    expect(body.get("dd_amphur")).toBe("พระนคร");
    expect(body.get("dd_province2")).toBe("เชียงใหม่");
    expect(body.get("dd_amphur2")).toBe("เมืองเชียงใหม่");
  });

  it("falls back to natal place when transit place omitted", () => {
    const body = buildMyhoraFormBody(natal, "vs", "gen", "asc", {
      day: 2,
      month: 9,
      year: 2026,
      time: "14:22",
    });

    expect(body.get("dd_province2")).toBe("กรุงเทพมหานคร");
    expect(body.get("dd_amphur2")).toBe("พระนคร");
  });
});
