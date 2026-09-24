import { describe, expect, it } from "vitest";
import {
  buildHouseChains,
  formatHouseChainsForPrompt,
  formatPlanetFactsForPrompt,
} from "@/lib/house-chains";
import { dignityLabel, elementOf, lordOfSign } from "@/lib/thai-dignity";
import { normalizeSignName } from "@/lib/chart-theme";
import { isOverviewQuestion } from "@/lib/reading-intent";

// 1 Feb 1976 16:00 Bangkok, as the local engine computes it.
const chart = {
  lagna: "มิถุน",
  planets: [
    { planet: "อาทิตย์", siderealSign: "มกร" },
    { planet: "จันทร์", siderealSign: "กุมภ์" }, // the spelling that used to vanish
    { planet: "อังคาร", siderealSign: "พฤษภ" },
    { planet: "พุธ", siderealSign: "ธนู" },
    { planet: "พฤหัสบดี", siderealSign: "มีน" },
    { planet: "ศุกร์", siderealSign: "ธนู" },
    { planet: "เสาร์", siderealSign: "กรกฎ" },
    { planet: "ราหู", siderealSign: "ตุลย์" },
    { planet: "เกตุ", siderealSign: "กุมภ์" },
  ],
  taksa: [
    { taksa: "ศรี", planet: "พุธ", planetNum: 4, index: 3 },
    { taksa: "อุตสาหะ", planet: "พฤหัสบดี", planetNum: 5, index: 5 },
  ],
};

describe("dignity, lords and elements", () => {
  it("adds ประ — the sign opposite a planet's own", () => {
    expect(dignityLabel("อังคาร", "พฤษภ")).toBe("ประ"); // opposite พิจิก
    expect(dignityLabel("เสาร์", "กรกฎ")).toBe("ประ"); // opposite มกร
  });

  it("spells นิจ the way the ตำรา does", () => {
    expect(dignityLabel("อาทิตย์", "ตุลย์")).toBe("นิจ");
  });

  it("recognises Saturn at home whichever way กุมภ is spelled", () => {
    expect(dignityLabel("เสาร์", "กุมภ")).toBe("เกษตร");
    expect(dignityLabel("เสาร์", "กุมภ์")).toBe("เกษตร");
    expect(lordOfSign("กุมภ์")).toBe("เสาร์");
  });

  it("uses only the team's element table", () => {
    expect(elementOf("อาทิตย์")).toBe("ไฟ");
    expect(elementOf("จันทร์")).toBe("ดิน");
    expect(elementOf("ราหู")).toBe("ลม");
    expect(elementOf("ศุกร์")).toBe("น้ำ");
    expect(elementOf("เกตุ")).toBeNull();
  });

  it("maps กุมภ์ to a real sign instead of dropping it", () => {
    expect(normalizeSignName("กุมภ์")).toBe("กุมภ");
    expect(normalizeSignName("สิงห")).toBe("สิงห์");
    expect(normalizeSignName("ราศีมีน")).toBe("มีน");
  });
});

describe("ภพผสมภพ", () => {
  const chains = buildHouseChains(chart);
  const chain = (house: number) => chains.find((c) => c.startHouse === house)!;

  it("builds a chain for every house", () => {
    expect(chains).toHaveLength(12);
  });

  it("follows the lord until it is at home", () => {
    // ตนุ = มิถุน → พุธ in ธนู (7th) → ปัตนิ's lord พฤหัสบดี in มีน, its own sign.
    const c = chain(1);
    expect(c.steps.map((s) => [s.lord, s.lordHouse])).toEqual([
      ["พุธ", 7],
      ["พฤหัสบดี", 10],
    ]);
    expect(c.ending).toContain("อยู่บ้านตัวเอง (เกษตร)");
  });

  it("stops when the story loops back", () => {
    // กดุมภะ = กรกฎ → จันทร์ in กุมภ์ (9th) → ศุภะ's lord เสาร์ in กรกฎ (2nd) again.
    const c = chain(2);
    expect(c.steps.map((s) => s.lord)).toEqual(["จันทร์", "เสาร์"]);
    expect(c.ending).toContain("วนกลับมาที่ภพ 2");
  });

  it("carries co-tenants, aspects, element pairs and ทักษา for each lord", () => {
    const mercury = chain(1).steps[0]!;
    expect(mercury.dignity).toBe("ประ");
    expect(mercury.taksa).toBe("ศรี");
    expect(mercury.contacts).toContainEqual(
      expect.objectContaining({ kind: "ร่วมเรือน", body: "ศุกร์", sameElement: true }),
    );
  });

  it("writes each planet once and keeps the chains short", () => {
    const facts = formatPlanetFactsForPrompt(chains).join("\n");
    const paths = formatHouseChainsForPrompt(chains).join("\n");
    expect(facts.match(/^- พุธ /gm)).toHaveLength(1);
    expect(facts).toContain("ร่วมเรือนกับศุกร์ (คู่ธาตุน้ำ)");
    expect(paths).toContain("- ภพ 1 ตนุ (ราศีมิถุน): เจ้าเรือนพุธ ไปสถิตภพ 7 ปัตนิ");
    expect(facts.length + paths.length).toBeLessThan(5_000);
  });

  it("returns nothing when there is no usable lagna", () => {
    expect(buildHouseChains({ ...chart, lagna: null })).toEqual([]);
  });
});

describe("overview or single question", () => {
  it("recognises a request for the whole chart", () => {
    expect(isOverviewQuestion("ขอดูดวงภาพรวมทั้งปี")).toBe(true);
    expect(isOverviewQuestion("ดูดวงทุกด้านให้หน่อย")).toBe(true);
  });

  it("leaves a single question single", () => {
    expect(isOverviewQuestion("เดือนหน้าการงานเป็นยังไง")).toBe(false);
    expect(isOverviewQuestion("จะได้ย้ายงานไหม")).toBe(false);
  });
});
