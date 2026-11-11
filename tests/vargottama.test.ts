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
