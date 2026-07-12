import { describe, expect, it } from "vitest";
import { DISTRICTS, PROVINCES } from "@/data/thailand-geo";

describe("thailand-geo", () => {
  it("lists 77 provinces with district data for each", () => {
    expect(PROVINCES).toHaveLength(77);
    for (const province of PROVINCES) {
      expect(DISTRICTS[province]?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it("includes full Bangkok and Chiang Mai district sets", () => {
    expect(DISTRICTS["กรุงเทพมหานคร"]).toHaveLength(50);
    expect(DISTRICTS["เชียงใหม่"]).toHaveLength(25);
    expect(DISTRICTS["เชียงใหม่"]).toContain("เมืองเชียงใหม่");
  });
});
