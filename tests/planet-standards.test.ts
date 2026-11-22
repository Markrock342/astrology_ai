import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_PLANET_STANDARDS,
  applyPlanetStandards,
  formatPlanetStandardsForPrompt,
  planetStandardsVersion,
  validatePlanetStandards,
  type PlanetStandardsTable,
} from "@/lib/planet-standards";
import { dignityLabel, extraStandardLabels, lordLabel, lordOfSign } from "@/lib/thai-dignity";
import { deriveSamrapColumns } from "@/lib/samrap-derive";
import { buildHouseChains } from "@/lib/house-chains";

// 22 Nov 2026: A asked for the standards as a table the team edits, not code.
const edited = (): PlanetStandardsTable => {
  const t: PlanetStandardsTable = JSON.parse(JSON.stringify(DEFAULT_PLANET_STANDARDS));
  t.planets.ราหู.ราชาโชค = ["ตุลย"]; // what the member said
  t.planets.ราหู.อุจจ์ = ["พิจิก"];
  return t;
};

afterEach(() => applyPlanetStandards(DEFAULT_PLANET_STANDARDS));

describe("ตารางมาตรฐานดาว", () => {
  it("defaults to what the app used before, with ราหู holding กุมภ์", () => {
    expect(lordOfSign("กุมภ์")).toBe("ราหู");
    expect(lordLabel("กุมภ์")).toBe("ราหู (เจ้าเรือนเดิม เสาร์)");
    expect(lordOfSign("สิงห์")).toBe("อาทิตย์");
    expect(dignityLabel("อาทิตย์", "เมษ")).toBe("อุจจ์");
    expect(dignityLabel("เสาร์", "กรกฎ")).toBe("ประ");
    expect(dignityLabel("ราหู", "ตุลย์")).toBe("ปกติ");
    expect(dignityLabel("เกตุ", "ตุลย์")).toBe("—");
    expect(extraStandardLabels("ราหู", "ตุลย์")).toEqual([]);
  });

  it("drives the chart table, the dignity words and the prompt once the team edits it", () => {
    const before = planetStandardsVersion();
    applyPlanetStandards(edited());
    expect(planetStandardsVersion()).not.toBe(before);

    expect(dignityLabel("ราหู", "พิจิก")).toBe("อุจจ์");
    expect(extraStandardLabels("ราหู", "ตุลย์")).toEqual(["ราชาโชค"]);
    // ราหู at 10° ตุลย์ (longitude 190°) in the derived chart table.
    expect(deriveSamrapColumns("ราหู", 190, "กันย์").rerkStandard).toContain("ราชาโชค");

    const prompt = formatPlanetStandardsForPrompt().join("\n");
    expect(prompt).toContain("- ราหู: อุจจ์ พิจิก · เกษตร กุมภ์ · ประ สิงห์ · ราชาโชค ตุลย์");
    expect(prompt).toContain("กุมภ์ ราหู (เจ้าเรือนเดิม เสาร์)");
  });

  it("moves the house chains when a lord changes", () => {
    const t = edited();
    t.lords.กุมภ = "เสาร์";
    t.originalLords = {};
    applyPlanetStandards(t);
    const chains = buildHouseChains({ lagna: "มิถุน", planets: [{ planet: "เสาร์", siderealSign: "กรกฎ" }, { planet: "ราหู", siderealSign: "ตุลย์" }] } as never);
    expect(chains.find((c) => c.startHouse === 9)!.steps[0]!.lord).toBe("เสาร์");
    // นวางศ์'s middle number follows the lord too: 14° ตุลย์ falls in the
    // 5th navamsa, กุมภ์ → เสาร์ (7) now, ราหู (8) by default.
    expect(deriveSamrapColumns("เสาร์", 6 * 30 + 14, "มิถุน").nawamang).toBe("5 : 7 : กภ");
    applyPlanetStandards(DEFAULT_PLANET_STANDARDS);
    expect(deriveSamrapColumns("เสาร์", 6 * 30 + 14, "มิถุน").nawamang).toBe("5 : 8 : กภ");
  });

  it("rejects a table with a sign left without a lord or an unknown sign", () => {
    const missing = edited() as unknown as { lords: Record<string, string> };
    delete missing.lords.มีน;
    expect(validatePlanetStandards(missing)).toMatchObject({ ok: false });
    const bad = edited() as unknown as { planets: Record<string, Record<string, string[]>> };
    bad.planets.ราหู.อุจจ์ = ["ดาวอังคาร"];
    expect(validatePlanetStandards(bad)).toMatchObject({ ok: false });
    // An original lord equal to the lord is dropped, duplicates collapse.
    const t = edited();
    t.originalLords.เมษ = "อังคาร";
    t.planets.ราหู.ราชาโชค = ["ตุลย", "ตุลย"];
    const ok = validatePlanetStandards(t);
    expect(ok.ok && ok.table.originalLords.เมษ).toBeFalsy();
    expect(ok.ok && ok.table.planets.ราหู.ราชาโชค).toEqual(["ตุลย"]);
  });
});
