import { describe, expect, it } from "vitest";
import {
  bangkokDistrictId,
  findDistrictId,
  MYHORA_PROVINCE_IDS,
  normalizeDistrictLabel,
  parseAmphurOptions,
  parseDeltaViewState,
} from "@/server/horoscope/engine/myhora/place-ids";
import { buildMyhoraFormBody } from "@/server/horoscope/engine/myhora/fetch-myhora";
import { PROVINCES } from "@/data/thailand-geo";

describe("myhora place ids", () => {
  it("knows every province the birth form offers", () => {
    expect(PROVINCES.filter((p) => !MYHORA_PROVINCE_IDS[p])).toEqual([]);
    expect(MYHORA_PROVINCE_IDS["สกลนคร"]).toBe("57");
    expect(MYHORA_PROVINCE_IDS["กรุงเทพมหานคร"]).toBe("1");
  });

  it("matches district labels regardless of เขต/อ. prefixes", () => {
    expect(normalizeDistrictLabel("อ.สว่างแดนดิน")).toBe("สว่างแดนดิน");
    expect(normalizeDistrictLabel("เขตพระนคร")).toBe("พระนคร");
    expect(bangkokDistrictId("พระนคร")).toBe("40");
    expect(
      findDistrictId({ "อ.เมืองสกลนคร": "801", "อ.สว่างแดนดิน": "812" }, "สว่างแดนดิน"),
    ).toBe("812");
  });

  it("reads the rebound district list and view state out of a partial postback", () => {
    const delta =
      '1|#|4|1234|updatePanel|up_natal|<select name="dd_amphur" id="dd_amphur">' +
      '<option value="801">อ.เมืองสกลนคร</option><option selected="selected" value="812">อ.สว่างแดนดิน</option></select>|' +
      "0|hiddenField|__VIEWSTATE|/wEPDwUKLTE=|0|hiddenField|__VIEWSTATEGENERATOR|ABCD1234|";
    expect(parseAmphurOptions(delta)).toEqual({ "อ.เมืองสกลนคร": "801", "อ.สว่างแดนดิน": "812" });
    expect(parseDeltaViewState(delta)).toEqual({ viewState: "/wEPDwUKLTE=", generator: "ABCD1234" });
  });

  it("submits ids instead of names once resolved", () => {
    const body = buildMyhoraFormBody(
      { day: 19, month: 6, year: 2002, time: "22:43", country: "ไทย", province: "สกลนคร", district: "สว่างแดนดิน" },
      "vs",
      "gen",
      "3",
      { day: 16, month: 9, year: 2026, time: "12:00", province: "กรุงเทพมหานคร", district: "พระนคร" },
      { province: "57", amphur: "812", province2: "1", amphur2: "40" },
    );
    expect(body.get("dd_province")).toBe("57");
    expect(body.get("dd_amphur")).toBe("812");
    expect(body.get("dd_province2")).toBe("1");
    expect(body.get("dd_amphur2")).toBe("40");
    expect(body.get("dd_country")).toBe("215");
    expect(body.get("dd_suriyayas_asc")).toBe("3");
  });
});
