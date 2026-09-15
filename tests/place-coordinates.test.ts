import { describe, expect, it } from "vitest";
import { DISTRICTS } from "@/data/thailand-geo";
import { resolvePlaceCoords } from "@/server/horoscope/engine/newhora/data/placeCoordinates";

describe("resolvePlaceCoords", () => {
  it("uses the district's own coordinates, not the province centre", () => {
    const place = resolvePlaceCoords("ไทย", "สกลนคร", "สว่างแดนดิน");
    // myhora: ละติจูด 17.475000° ลองจิจูด 103.458000°
    expect(place.lat).toBeCloseTo(17.475, 2);
    expect(place.lon).toBeCloseTo(103.458, 2);
    const capital = resolvePlaceCoords("ไทย", "สกลนคร", "เมืองสกลนคร");
    expect(capital.lon).not.toBeCloseTo(place.lon, 1);
  });

  it("has coordinates for every district the birth form offers", () => {
    const missing: string[] = [];
    for (const [province, districts] of Object.entries(DISTRICTS)) {
      const fallback = resolvePlaceCoords("ไทย", province, "");
      for (const district of districts) {
        const place = resolvePlaceCoords("ไทย", province, district);
        if (place.lat === fallback.lat && place.lon === fallback.lon && district !== `เมือง${province}`) {
          missing.push(`${province}/${district}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("keeps the hand-checked Bangkok entries", () => {
    expect(resolvePlaceCoords("ไทย", "กรุงเทพมหานคร", "พระนคร")).toMatchObject({
      lat: 13.752555,
      lon: 100.494066,
    });
  });
});
