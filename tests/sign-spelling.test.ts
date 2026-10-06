import { describe, expect, it } from "vitest";
import { houseFromLagna } from "@/server/horoscope/engine/format-chart-prompt";

// The 100-year table spells กุมภ์; the sign list กุมภ. Planets in Aquarius
// got no house in the prompt ("เสาร์: กุมภ์ เรือน—").
describe("houseFromLagna with the table's spelling", () => {
  it("places a planet in กุมภ์", () => {
    expect(houseFromLagna("มกร", "กุมภ์")).toBe(2);
    expect(houseFromLagna("กุมภ์", "มีน")).toBe(2);
    expect(houseFromLagna("เมษ", "กุมภ")).toBe(11);
  });
});
