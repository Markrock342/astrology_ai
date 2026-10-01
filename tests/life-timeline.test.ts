import { describe, expect, it } from "vitest";
import { formatLifeTimelineForPrompt, scanLifeTimeline, thaiMonthYear } from "@/lib/life-timeline";
import { isTimelineQuestion, timelineIncludesPast } from "@/lib/reading-intent";
import { checkAnswerAgainstTrace } from "@/lib/reading-trace-check";
import type { ReadingPromptTrace } from "@/types/reading-trace";

const SIGNS = ["เมษ", "พฤษภ", "มิถุน", "กรกฎ", "สิงห์", "กันย์", "ตุลย์", "พิจิก", "ธนู", "มกร", "กุมภ", "มีน"];
const monthIndex = (d: Date) => (d.getUTCFullYear() - 2026) * 12 + d.getUTCMonth();

// A synthetic sky: Saturn one sign every 30 months with a retrograde wiggle at
// each change; Jupiter one sign a year; Rahu and Uranus parked; Ketu racing.
function sky(at: Date) {
  const m = monthIndex(at);
  const satBase = Math.floor(m / 30);
  const inWiggle = m % 30 === 2 || m % 30 === 3; // steps back for two months
  const saturn = SIGNS[(11 + satBase - (inWiggle && satBase > 0 ? 1 : 0)) % 12]!;
  return [
    { planet: "เสาร์", siderealSign: saturn },
    { planet: "พฤหัสบดี", siderealSign: SIGNS[(3 + Math.floor(m / 12)) % 12]! },
    { planet: "ราหู", siderealSign: "กุมภ" },
    { planet: "มฤตยู", siderealSign: "พฤษภ" },
    { planet: "เกตุ", siderealSign: SIGNS[m % 12]! },
  ];
}

const natal = {
  natalLagna: "มิถุน",
  natalPlanets: [
    { planet: "พุธ", siderealSign: "ธนู" },
    { planet: "ศุกร์", siderealSign: "ธนู" },
  ],
  birth: { day: 1, month: 2, year: 1976 },
};

function scan(extra: Partial<Parameters<typeof scanLifeTimeline>[0]> = {}) {
  return scanLifeTimeline({
    ...natal,
    from: new Date(Date.UTC(2026, 0, 1)),
    to: new Date(Date.UTC(2036, 0, 1)),
    now: new Date(Date.UTC(2026, 8, 15)),
    topicHouses: [1, 10, 7, 2, 11],
    positionsAt: sky,
    limit: 50,
    ...extra,
  })!;
}

describe("life timeline scan", () => {
  it("records each slow-planet entry with its natal house and the age then", () => {
    const t = scan();
    const saturn = t.events.filter((e) => e.planet === "เสาร์");
    expect(saturn[0]).toMatchObject({ sign: "เมษ", natalHouse: 11, age: 52 });
  });

  it("folds a retrograde step back into the entry it interrupted", () => {
    const saturn = scan().events.filter((e) => e.planet === "เสาร์");
    // One event per sign, each with its retreat and final settling recorded.
    expect(new Set(saturn.map((e) => e.sign)).size).toBe(saturn.length);
    expect(saturn[0]!.retreatedAt).not.toBeNull();
    expect(saturn[0]!.settledAt).not.toBeNull();
  });

  it("ignores เกตุ, which laps the zodiac in the Thai system", () => {
    expect(scan().events.some((e) => e.planet === "เกตุ")).toBe(false);
  });

  it("scores an entry onto the lagna above one far from it", () => {
    const t = scan();
    const onLagna = t.events.find((e) => e.planet === "เสาร์" && e.natalHouse === 1);
    const eleventh = t.events.find((e) => e.planet === "เสาร์" && e.natalHouse === 11);
    expect(onLagna!.score).toBeGreaterThan(eleventh!.score);
    expect(onLagna!.contacts).toContainEqual({ kind: "กุม", body: "ลัคนา" });
  });

  it("keeps the strongest few, in date order", () => {
    const t = scan({ limit: 4 });
    expect(t.events).toHaveLength(4);
    const times = t.events.map((e) => e.at.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it("writes Thai months, Buddhist years and ages the model can quote", () => {
    const text = formatLifeTimelineForPrompt(scan({ limit: 3 })).join("\n");
    expect(text).toContain("[timeline]");
    expect(text).toMatch(/อายุ \d+/);
    expect(thaiMonthYear(new Date(Date.UTC(2028, 4, 1)))).toBe("พ.ค. 2571");
  });
});

describe("which questions get a timeline", () => {
  it("catches 'when will my life turn' questions", () => {
    expect(isTimelineQuestion("ชีวิตผมจะพลิกล็อค หรือ กลับด้าน หรือจุดเปลี่ยนตอนไหนอายุเท่าไหร่เดือนไหนปีไหน")).toBe(true);
    expect(isTimelineQuestion("เมื่อไหร่จะได้แต่งงาน")).toBe(true);
    expect(isTimelineQuestion("ดวงจะขึ้นตอนอายุเท่าไร")).toBe(true);
  });

  it("leaves a named period and a natal question alone", () => {
    expect(isTimelineQuestion("เดือนหน้าการงานเป็นยังไง")).toBe(false);
    expect(isTimelineQuestion("อีก 3 เดือนจะได้งานไหม")).toBe(false);
    expect(isTimelineQuestion("นิสัยของฉันเป็นยังไง")).toBe(false);
  });

  it("looks back only when asked about the past or a whole life", () => {
    expect(timelineIncludesPast("ที่ผ่านมาชีวิตพลิกตอนไหน")).toBe(true);
    expect(timelineIncludesPast("จะพลิกตอนไหน")).toBe(false);
  });
});

describe("years the answer may use", () => {
  const trace = {
    version: 1,
    createdAt: "2026-09-30T05:00:00.000Z",
    question: "จะพลิกตอนไหน",
    answerMode: "detailed",
    plan: "PRO",
    intent: "natal",
    window: { label: "", sampleAt: "", horizonAt: null, pickedByUser: false },
    natal: { lagna: "มิถุน", birthDisplay: null, source: null, planets: [] },
    transit: null,
    knowledge: { budgetChars: 0, usedChars: 0, chunks: [] },
    templates: { system: null, persona: null, format: null },
    model: null,
    systemPrompt: "rules",
    userPrompt:
      "[timeline] จุดเปลี่ยน…\n- ก.ค. 2575 · อายุ 56 · เสาร์จรเข้าราศีมิถุน\n- ต.ค. 2580 · อายุ 61 · ราหูจรเข้าราศีมิถุน\n\nข้อมูลผู้ถาม:\n- วันเกิด: 1976-02-01",
  } as unknown as ReadingPromptTrace;

  it("accepts years from the timeline, the asking year and the birth year", () => {
    const r = checkAnswerAgainstTrace("ช่วงปี 2575 ชีวิตพลิก ส่วนปี 2580 ต้องระวัง นับจากปี 2569 ที่ถาม และเกิดปี 2519", trace);
    expect(r.flags.filter((f) => f.kind === "timeline_year")).toHaveLength(0);
  });

  it("flags a year the model made up, Buddhist or Christian", () => {
    const r = checkAnswerAgainstTrace("จุดเปลี่ยนใหญ่ปี 2578 และอีกทีปี 2040", trace);
    expect(r.flags.filter((f) => f.kind === "timeline_year").map((f) => f.detail)).toEqual([
      expect.stringContaining("2578"),
      expect.stringContaining("2583"),
    ]);
  });
});

describe("a whole-life timeline", () => {
  it("runs from now to age 90, marking months outside the 100-year table", async () => {
    const { computeNatalChartFormula } = await import("@/server/horoscope/engine/compute-chart");
    const { buildLifeTimelinePrompt } = await import("@/server/horoscope/life-timeline-service");
    const natal = computeNatalChartFormula({ day: 18, month: 11, year: 2001, time: "02:08", country: "ไทย", province: "นครราชสีมา", district: "โชคชัย" });
    const text = buildLifeTimelinePrompt({
      natal,
      memory: null,
      question: "ทั้งชีวิตมีเกณฑ์ได้เงินก้อนช่วงไหนบ้าง",
      categorySlug: "finance",
      now: new Date("2026-10-01T03:00:00Z"),
    })!;
    expect(text).toContain("ช่วง ต.ค. 2569 ถึง พ.ย. 2634");
    expect(text).toContain("นอกปฏิทินดาว 100 ปี");
    expect(text).not.toMatch(/อายุ 0 ·/);
    expect(text.split("\n").filter((l) => l.startsWith("- "))).toHaveLength(20);
  });
});
