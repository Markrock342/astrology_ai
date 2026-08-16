import { describe, expect, it } from "vitest";
import {
  computeTaksaFromLagna,
  TAKSA_CELL_NUMBERS,
  taksaIndexFromCellNumber,
} from "@/lib/taksa";

describe("taksa nine-cell layout", () => {
  it("puts ๙ (engine index 0 / lagna) in the center", () => {
    expect(taksaIndexFromCellNumber(9)).toBe(0);
    expect(TAKSA_CELL_NUMBERS[1][1]).toBe(9);
  });

  it("maps cells ๑–๘ to engine indexes 1–8", () => {
    expect(taksaIndexFromCellNumber(1)).toBe(1);
    expect(taksaIndexFromCellNumber(8)).toBe(8);
  });

  it("starts the center slot on the lagna sign", () => {
    const slots = computeTaksaFromLagna("กันย์");
    expect(slots).toHaveLength(9);
    expect(slots[0]?.sign).toBe("กันย์");
    expect(slots[0]?.taksa).toBe("กาลกุล");
  });
});
