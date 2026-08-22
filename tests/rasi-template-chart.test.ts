import { describe, expect, it } from "vitest";
import { SIGNS } from "@/lib/chart-theme";
import {
  SIGN_RULER_NUMERALS,
  TEMPLATE_SIGN_CENTERS,
  templateHouseLabels,
} from "@/components/app/rasi-template-chart";

describe("Horasard Illustrator rasi template contract", () => {
  it("keeps Aries at the top and orders signs counterclockwise", () => {
    expect(SIGNS[0]).toBe("เมษ");
    expect(TEMPLATE_SIGN_CENTERS[0]).toEqual({ x: 210, y: 105 });
    expect(TEMPLATE_SIGN_CENTERS[1].x).toBeLessThan(210);
    expect(TEMPLATE_SIGN_CENTERS[11].x).toBeGreaterThan(210);
    expect(TEMPLATE_SIGN_CENTERS[6]).toEqual({ x: 210, y: 315 });
  });

  it("uses the sign-ruler numerals printed in the Illustrator asset", () => {
    expect(SIGN_RULER_NUMERALS).toEqual([
      "๓",
      "๖",
      "๔",
      "๒",
      "๑",
      "๔",
      "๖",
      "๓",
      "๕",
      "๗",
      "๘",
      "๕",
    ]);
  });

  it("moves bhava names with lagna without rotating the zodiac", () => {
    const ariesLagna = templateHouseLabels("เมษ");
    expect(ariesLagna[0]).toBe("ตนุ");
    expect(ariesLagna[1]).toBe("กดุมภะ");
    expect(ariesLagna[11]).toBe("วินาศ");

    const cancerLagna = templateHouseLabels("กรกฎ");
    expect(cancerLagna[0]).toBe("กัมมะ");
    expect(cancerLagna[3]).toBe("ตนุ");
    expect(TEMPLATE_SIGN_CENTERS[0]).toEqual({ x: 210, y: 105 });
  });
});
