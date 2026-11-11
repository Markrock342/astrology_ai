import { describe, expect, it } from "vitest";
import { isVargottama } from "@/lib/chart-derivations";

// A, 11 Nov 2026: MyHora marks "โคตม" when the navamsa sign equals the rasi sign.
describe("วรโคตมนวางค์", () => {
  it("marks a planet whose navamsa is its own rasi sign", () => {
    expect(isVargottama("กรกฎ", "1:2:กฎ")).toBe(true);
    expect(isVargottama("กฎ", "1:2:กฎ")).toBe(true);
    expect(isVargottama("ธนู", "3:5:ธน")).toBe(true);
  });

  it("leaves the rest unmarked", () => {
    expect(isVargottama("เมษ", "6:4:มถ")).toBe(false);
    expect(isVargottama("กรกฎ", "")).toBe(false);
    expect(isVargottama(null, "1:2:กฎ")).toBe(false);
  });
});

// A's rule (11 Nov 2026): movable signs in navamsa 1 (0°–3°20'), fixed in
// navamsa 5 (13°20'–16°40'), dual in navamsa 9 (26°40'–30°). Same-sign in
// D1 and D9 must give exactly that, for every sign at every degree.
import { computeNavamsaSign } from "@/lib/chart-derivations";
import { SIGNS } from "@/lib/chart-theme";

describe("วรโคตม follows the team's three groups", () => {
  const movable = ["เมษ", "กรกฎ", "ตุลย์", "มกร"];
  const fixed = ["พฤษภ", "สิงห์", "พิจิก", "กุมภ"];
  const expected = (sign: string, deg: number) => {
    const part = Math.floor(deg / (30 / 9)) + 1;
    return movable.includes(sign) ? part === 1 : fixed.includes(sign) ? part === 5 : part === 9;
  };
  it("matches at every 10 arc-minutes", () => {
    for (const sign of SIGNS) {
      for (let m = 0; m < 30 * 60; m += 10) {
        const deg = m / 60;
        const nav = computeNavamsaSign(sign, deg);
        expect(isVargottama(sign, `x:x:${nav}`), `${sign} ${deg}°`).toBe(expected(sign, deg));
      }
    }
  });
});
