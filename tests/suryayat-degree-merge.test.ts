import { describe, expect, it } from "vitest";
import { mergeVerifiedFormulaDegrees } from "@/server/horoscope/engine/newhora/formulas/pipeline";

describe("Suriyayat degree verification", () => {
  it("adds a formula degree only when its sign matches the Suriyayat sign", () => {
    const rows = mergeVerifiedFormulaDegrees(
      [
        { planet: "อาทิตย์", siderealSign: "มกร" },
        { planet: "จันทร์", siderealSign: "ตุลย์" },
      ],
      [
        {
          planet: "อาทิตย์",
          siderealSign: "มกร",
          degreeInSign: 12.5,
          degreeText: "12° 30'",
        },
        {
          planet: "จันทร์",
          siderealSign: "พิจิก",
          degreeInSign: 1,
          degreeText: "1° 00'",
        },
      ],
    );

    expect(rows[0]).toMatchObject({
      siderealSign: "มกร",
      degreeInSign: 12.5,
      degreeText: "12° 30'",
    });
    expect(rows[1]).toEqual({ planet: "จันทร์", siderealSign: "ตุลย์" });
  });
});
