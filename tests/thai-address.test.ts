import { describe, expect, it } from "vitest";
import { matchThaiReverseAddress, formatThaiLocationLine } from "@/lib/thai-address";

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

  it("does not stamp Bangkok GPS as พระนคร just because the city field is กรุงเทพมหานคร", () => {
    expect(
      matchThaiReverseAddress({
        country_code: "th",
        city: "กรุงเทพมหานคร",
        suburb: "แขวงคลองตันเหนือ",
        city_district: "เขตวัฒนา",
      }),
    ).toEqual({
      province: "กรุงเทพมหานคร",
      district: "วัฒนา",
      areaLabel: "คลองตันเหนือ · วัฒนา · กรุงเทพมหานคร",
    });
  });

  it("does not treat the province name itself as a district", () => {
    expect(
      matchThaiReverseAddress({
        country_code: "th",
        state: "กรุงเทพมหานคร",
        city: "กรุงเทพมหานคร",
      }),
    ).toMatchObject({
      province: "กรุงเทพมหานคร",
      district: "",
    });
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

describe("formatThaiLocationLine", () => {
  it("labels Bangkok as เขต and other provinces as อำเภอ", () => {
    expect(
      formatThaiLocationLine({
        district: "วัฒนา",
        province: "กรุงเทพมหานคร",
        country: "ไทย",
      }),
    ).toBe("เขตวัฒนา กรุงเทพมหานคร");
    expect(
      formatThaiLocationLine({
        district: "หางดง",
        province: "เชียงใหม่",
        country: "ไทย",
      }),
    ).toBe("อำเภอหางดง จังหวัดเชียงใหม่");
  });
});
