import { describe, expect, it } from "vitest";
import { matchThaiReverseAddress } from "@/lib/thai-address";

describe("matchThaiReverseAddress", () => {
  it("maps Bangkok khet names to canonical dropdown values", () => {
    expect(
      matchThaiReverseAddress({
        country_code: "th",
        state: "กรุงเทพมหานคร",
        city_district: "เขตวัฒนา",
        suburb: "แขวงคลองตันเหนือ",
      }),
    ).toEqual({
      province: "กรุงเทพมหานคร",
      district: "วัฒนา",
      areaLabel: "คลองตันเหนือ · วัฒนา · กรุงเทพมหานคร",
    });
  });

  it("understands the field shape returned by Nominatim for Bangkok", () => {
    expect(
      matchThaiReverseAddress({
        country_code: "th",
        quarter: "แขวงบวรนิเวศ",
        suburb: "เขตพระนคร",
        city: "กรุงเทพมหานคร",
      }),
    ).toEqual({
      province: "กรุงเทพมหานคร",
      district: "พระนคร",
      areaLabel: "บวรนิเวศ · พระนคร · กรุงเทพมหานคร",
    });
  });

  it("maps amphoe prefixes outside Bangkok", () => {
    expect(
      matchThaiReverseAddress({
        country_code: "th",
        state: "จังหวัดเชียงใหม่",
        county: "อำเภอหางดง",
      }),
    ).toMatchObject({ province: "เชียงใหม่", district: "หางดง" });
  });

  it("does not pretend an overseas coordinate is supported", () => {
    expect(
      matchThaiReverseAddress({
        country_code: "sg",
        state: "Singapore",
      }),
    ).toBeNull();
  });
});
