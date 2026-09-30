import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { companionSchema, companionsSchema, COMPANION_QUESTION_PATTERN } from "@/lib/companions";
import { computeSynastry, formatCompanionChart, formatSynastryForPrompt } from "@/lib/synastry";
import {
  fetchSompong,
  formatSompongForPrompt,
  parseSompongHtml,
  sompongBand,
} from "@/server/horoscope/sompong-service";

const fixture = (name: string) => readFileSync(join(__dirname, "fixtures", name), "utf8");

const person = {
  nickname: "มายด์",
  relation: "partner",
  birthDate: "1995-08-20",
  birthTime: "08:30",
  province: "กรุงเทพมหานคร",
};

describe("companion schema", () => {
  it("accepts a person and fills the defaults", () => {
    const parsed = companionSchema.parse(person);
    expect(parsed.country).toBe("ไทย");
    expect(parsed.district).toBe("");
  });

  it("allows an unknown birth time", () => {
    expect(companionSchema.safeParse({ ...person, birthTime: null }).success).toBe(true);
  });

  it("rejects a Buddhist-era date string and a bad relation", () => {
    expect(companionSchema.safeParse({ ...person, birthDate: "20/08/2538" }).success).toBe(false);
    expect(companionSchema.safeParse({ ...person, relation: "boss" }).success).toBe(false);
  });

  it("caps the list at three people", () => {
    expect(companionsSchema.safeParse([person, person, person]).success).toBe(true);
    expect(companionsSchema.safeParse([person, person, person, person]).success).toBe(false);
  });

  it("spots a two-person question", () => {
    expect(COMPANION_QUESTION_PATTERN.test("ดวงสมพงษ์กับแฟนเป็นยังไง")).toBe(true);
    expect(COMPANION_QUESTION_PATTERN.test("งานปีนี้เป็นยังไง")).toBe(false);
  });
});

describe("synastry", () => {
  const user = {
    lagna: "มิถุน",
    planets: [
      { planet: "ศุกร์", siderealSign: "ธนู" },
      { planet: "จันทร์", siderealSign: "เมษ" },
      { planet: "เกตุ", siderealSign: "ตุลย์" },
    ],
  };
  const other = {
    lagna: "ธนู",
    planets: [
      { planet: "อังคาร", siderealSign: "ธนู" },
      { planet: "ศุกร์", siderealSign: "เมษ" },
      { planet: "เกตุ", siderealSign: "ธนู" },
    ],
  };

  it("works out the lagnas, placements and contacts", () => {
    const s = computeSynastry(user, other, [7, 5]);
    expect(s.lagnaRelation).toEqual({ kind: "เล็ง", house: 7 });
    expect(s.otherInUserHouses).toContainEqual({ planet: "อังคาร", sign: "ธนู", house: 7 });
    expect(s.contacts).toContainEqual(
      expect.objectContaining({ userPlanet: "ศุกร์", otherPlanet: "อังคาร", kind: "กุม" }),
    );
    expect(s.contacts.some((c) => c.userPlanet === "เกตุ" || c.otherPlanet === "เกตุ")).toBe(false);
    expect(s.relationHouses[0]).toMatchObject({ house: 7, otherPlanetsThere: ["อังคาร", "เกตุ"] });
  });

  it("gives no houses for a person without a birth time", () => {
    const s = computeSynastry(user, { ...other, lagna: null }, [7]);
    expect(s.lagnaRelation).toBeNull();
    expect(s.userInOtherHouses).toEqual([]);
    const chart = formatCompanionChart(1, "มายด์ (แฟน)", null, { ...other, lagna: null });
    expect(chart[0]).toContain("ห้ามพูดถึงลัคนาและภพ");
    expect(chart[1]).not.toContain("ภพ");
  });

  it("formats blocks the prompt can cite", () => {
    const lines = formatSynastryForPrompt(1, "มายด์ (แฟน)", computeSynastry(user, other, [7]), "มายด์");
    expect(lines[0]).toMatch(/^\[synastry_1\] ดวงของผู้ถามกับมายด์ \(แฟน\)/);
    expect(lines.join("\n")).toContain("ศุกร์–อังคาร กุม");
  });
});

describe("ดวงสมพงษ์", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads a negative score and its three factors", () => {
    const r = parseSompongHtml(fixture("sompong-minus10.html"));
    expect(r?.score).toBe(-10);
    expect(r?.band).toBe("ดวงชะตาไม่ค่อยสมพงษ์ มีปัญหาและอุปสรรค");
    expect(r?.factors.map((f) => f.factor)).toEqual(["วันที่เกิด", "เดือนที่เกิด", "ปีที่เกิด"]);
    expect(r?.factors[0]).toMatchObject({ a: "อาทิตย์", b: "อังคาร" });
  });

  it("puts a shared band edge in the better band", () => {
    expect(parseSompongHtml(fixture("sompong-20.html"))?.band).toBe("ดวงชะตาสมพงษ์กันดี");
    expect(sompongBand(0)).toBe("สมพงษ์กันปานกลาง");
    expect(sompongBand(-31)).toContain("ไม่เหมาะสม");
  });

  it("refuses a page without the three factors", () => {
    expect(parseSompongHtml("<p>ได้คะแนนดังนี้ 0</p>")).toBeNull();
    expect(parseSompongHtml("<html></html>")).toBeNull();
  });

  it("sends dates only, with two-digit months and Buddhist-era years", async () => {
    const fetchMock = vi.fn(async () => new Response(fixture("sompong-minus10.html")));
    vi.stubGlobal("fetch", fetchMock);
    const r = await fetchSompong({ year: 1976, month: 2, day: 1 }, { year: 1979, month: 6, day: 12 });
    expect(r?.score).toBe(-10);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = new URLSearchParams(String(init.body));
    expect(body.get("month")).toBe("02");
    expect(body.get("year")).toBe("2519");
    expect(body.get("year2")).toBe("2522");
    expect(body.get("name")).toBe("A");
  });

  it("skips years outside the site's table and survives a failure", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("down");
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await fetchSompong({ year: 1900, month: 1, day: 1 }, { year: 1990, month: 1, day: 1 })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await fetchSompong({ year: 1990, month: 1, day: 1 }, { year: 1991, month: 1, day: 1 })).toBeNull();
  });

  it("formats the score for the prompt", () => {
    const r = parseSompongHtml(fixture("sompong-minus10.html"))!;
    const lines = formatSompongForPrompt(1, "มายด์", r);
    expect(lines[0]).toMatch(/^\[sompong_1\]/);
    expect(lines[1]).toBe("- คะแนน -10 · ดวงชะตาไม่ค่อยสมพงษ์ มีปัญหาและอุปสรรค");
    expect(lines[2]).toContain("วันเกิด อาทิตย์–อังคาร");
  });
});
