import { describe, expect, it } from "vitest";
import {
  houseFromLagna,
  normalizeSignName,
  signIndex,
} from "@/lib/chart-theme";

/**
 * myhora stores signs as "NN : xx" (0-based index + abbreviation). The wheel
 * groups planets by full sign name, so a raw code that slips through renders
 * a chart with zero planets — exactly the production bug this locks out.
 */
describe("normalizeSignName", () => {
  it("decodes myhora index codes to full sign names", () => {
    expect(normalizeSignName("07 : พจ")).toBe("พิจิก");
    expect(normalizeSignName("09 : มก")).toBe("มกร");
    expect(normalizeSignName("06 : ตล")).toBe("ตุลย์");
    expect(normalizeSignName("02 : มถ")).toBe("มิถุน");
    expect(normalizeSignName("01 : พภ")).toBe("พฤษภ");
    expect(normalizeSignName("11 : มน")).toBe("มีน");
    expect(normalizeSignName("05 : กน")).toBe("กันย์");
    expect(normalizeSignName("00 : มษ")).toBe("เมษ");
  });

  it("passes full names and unknown strings through unchanged", () => {
    expect(normalizeSignName("กันย์")).toBe("กันย์");
    expect(normalizeSignName("ไม่รู้จัก")).toBe("ไม่รู้จัก");
  });

  it("rejects out-of-range indexes instead of wrapping", () => {
    expect(normalizeSignName("12 : ??")).toBe("12 : ??");
    expect(normalizeSignName("99 : ??")).toBe("99 : ??");
  });
});

describe("signIndex / houseFromLagna with coded signs", () => {
  it("indexes coded signs like full names", () => {
    expect(signIndex("07 : พจ")).toBe(signIndex("พิจิก"));
  });

  it("computes the house from lagna for coded planet signs", () => {
    // Lagna กันย์ (idx 5), planet พิจิก (idx 7) → house 3
    expect(houseFromLagna("กันย์", "07 : พจ")).toBe(3);
    expect(houseFromLagna("กันย์", "พิจิก")).toBe(3);
  });
});
