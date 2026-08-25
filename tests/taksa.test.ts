import { describe, expect, it } from "vitest";
import {
  combinedGridFromScraped,
  computeTaksaFromBirth,
  computeTransitTaksaByAge,
  computeTransitTaksaMethod1,
  formatTaksaDayHeading,
  resolveTaksaBirthDay,
  slotsForWeekday,
  TAKSA_CELL_PLANETS,
  TAKSA_NAMES,
  TAKSA_TRANSIT_NAMES,
  TAKSA_WEEKDAY_TABLE,
  taksaLabelByPlanetNum,
  taksaSlotsFromMyhoraGrid,
  yangKaoAge,
  type TaksaBirthDay,
} from "@/lib/taksa";
import type { BirthInputSnapshot } from "@/types/chart";

function input(day: number, time = "12:00"): BirthInputSnapshot {
  return {
    day,
    month: 8,
    year: 2026,
    time,
    country: "ไทย",
    province: "กรุงเทพมหานคร",
    district: "พระนคร",
  };
}

/** Customer reference grids (ทักษาเดิม) — planetNum → label. */
const NATAL_REF: Record<TaksaBirthDay, Record<number, string>> = {
  อาทิตย์: {
    1: "บริวาร", 2: "อายุ", 3: "เดช", 4: "ศรี",
    7: "มูละ", 5: "อุตสาหะ", 8: "มนตรี", 6: "กาลกิณี",
  },
  จันทร์: {
    2: "บริวาร", 3: "อายุ", 4: "เดช", 7: "ศรี",
    5: "มูละ", 8: "อุตสาหะ", 6: "มนตรี", 1: "กาลกิณี",
  },
  อังคาร: {
    3: "บริวาร", 4: "อายุ", 7: "เดช", 5: "ศรี",
    8: "มูละ", 6: "อุตสาหะ", 1: "มนตรี", 2: "กาลกิณี",
  },
  พุธกลางวัน: {
    4: "บริวาร", 7: "อายุ", 5: "เดช", 8: "ศรี",
    6: "มูละ", 1: "อุตสาหะ", 2: "มนตรี", 3: "กาลกิณี",
  },
  พุธกลางคืน: {
    8: "บริวาร", 6: "อายุ", 1: "เดช", 2: "ศรี",
    3: "มูละ", 4: "อุตสาหะ", 7: "มนตรี", 5: "กาลกิณี",
  },
  พฤหัสบดี: {
    5: "บริวาร", 8: "อายุ", 6: "เดช", 1: "ศรี",
    2: "มูละ", 3: "อุตสาหะ", 4: "มนตรี", 7: "กาลกิณี",
  },
  ศุกร์: {
    6: "บริวาร", 1: "อายุ", 2: "เดช", 3: "ศรี",
    4: "มูละ", 7: "อุตสาหะ", 5: "มนตรี", 8: "กาลกิณี",
  },
  เสาร์: {
    7: "บริวาร", 5: "อายุ", 8: "เดช", 6: "ศรี",
    1: "มูละ", 2: "อุตสาหะ", 3: "มนตรี", 4: "กาลกิณี",
  },
};

describe("traditional seven-day Taksa", () => {
  it("contains all seven days plus the Wednesday-night Rahu variant", () => {
    expect(Object.keys(TAKSA_WEEKDAY_TABLE)).toEqual([
      "อาทิตย์",
      "จันทร์",
      "อังคาร",
      "พุธกลางวัน",
      "พุธกลางคืน",
      "พฤหัสบดี",
      "ศุกร์",
      "เสาร์",
    ]);
    for (const slots of Object.values(TAKSA_WEEKDAY_TABLE)) {
      expect(slots.map((slot) => slot.taksa)).toEqual([...TAKSA_NAMES]);
      expect(new Set(slots.map((slot) => slot.planetNum)).size).toBe(8);
    }
  });

  it("keeps the fixed 3×3 number layout from the customer template", () => {
    expect(TAKSA_CELL_PLANETS).toEqual([
      [1, 2, 3],
      [6, 9, 4],
      [8, 5, 7],
    ]);
  });

  it("starts บริวาร from each weekday lord", () => {
    const cases = [
      [23, "อาทิตย์", 1],
      [24, "จันทร์", 2],
      [25, "อังคาร", 3],
      [26, "พุธกลางวัน", 4],
      [27, "พฤหัสบดี", 5],
      [28, "ศุกร์", 6],
      [29, "เสาร์", 7],
    ] as const;
    for (const [day, label, lord] of cases) {
      expect(resolveTaksaBirthDay(input(day))).toBe(label);
      expect(computeTaksaFromBirth(input(day))[0]).toMatchObject({
        taksa: "บริวาร",
        planetNum: lord,
      });
    }
  });

  it("matches the Saturday MyHora reference captured in the old NewHora repo", () => {
    const saturday = computeTaksaFromBirth(input(29));
    expect(Object.fromEntries(saturday.map((slot) => [slot.taksa, slot.planet]))).toEqual({
      บริวาร: "เสาร์",
      อายุ: "พฤหัสบดี",
      เดช: "ราหู",
      ศรี: "ศุกร์",
      มูละ: "อาทิตย์",
      อุตสาหะ: "จันทร์",
      มนตรี: "อังคาร",
      กาลกิณี: "พุธ",
    });
  });

  it("uses Rahu for Wednesday night until Thursday sunrise", () => {
    expect(resolveTaksaBirthDay(input(26, "17:59"))).toBe("พุธกลางวัน");
    expect(resolveTaksaBirthDay(input(26, "18:00"))).toBe("พุธกลางคืน");
    expect(resolveTaksaBirthDay(input(27, "05:59"))).toBe("พุธกลางคืน");
    expect(resolveTaksaBirthDay(input(27, "06:00"))).toBe("พฤหัสบดี");
    expect(computeTaksaFromBirth(input(26, "20:00"))[0]).toMatchObject({
      taksa: "บริวาร",
      planet: "ราหู",
      planetNum: 8,
    });
  });

  it("keeps Ketu in the centre but outside the eight Taksa duties", () => {
    expect(TAKSA_CELL_PLANETS[1][1]).toBe(9);
    expect(computeTaksaFromBirth(input(23)).some((slot) => slot.planetNum === 9)).toBe(false);
  });

  it("can adopt all eight exact natal labels parsed from MyHora", () => {
    const sunday = TAKSA_WEEKDAY_TABLE.อาทิตย์;
    const grid = TAKSA_CELL_PLANETS.map((row) =>
      row.map((planetNum) => {
        if (planetNum === 9) {
          return { label: "กลาง", planetNum: 9, transitLabel: "", isCenter: true };
        }
        const slot = sunday.find((item) => item.planetNum === planetNum)!;
        return { label: slot.taksa, planetNum, transitLabel: "" };
      }),
    );
    expect(taksaSlotsFromMyhoraGrid(grid)).toEqual(sunday);
  });
});

describe("customer reference grids (ทักษาเดิม + ทักษาจร Method 1)", () => {
  it("locks natal labels for all 8 weekday grids from the attached template", () => {
    for (const [day, expected] of Object.entries(NATAL_REF) as Array<
      [TaksaBirthDay, Record<number, string>]
    >) {
      expect(taksaLabelByPlanetNum(slotsForWeekday(day, "natal"))).toEqual(expected);
    }
  });

  it("locks transit Method-1 labels as natal + จร for the same weekday", () => {
    for (const [day, natalExpected] of Object.entries(NATAL_REF) as Array<
      [TaksaBirthDay, Record<number, string>]
    >) {
      const transitExpected = Object.fromEntries(
        Object.entries(natalExpected).map(([num, label]) => [Number(num), `${label}จร`]),
      );
      expect(taksaLabelByPlanetNum(slotsForWeekday(day, "transit"))).toEqual(
        transitExpected,
      );
      expect(slotsForWeekday(day, "transit").map((s) => s.taksa)).toEqual([
        ...TAKSA_TRANSIT_NAMES,
      ]);
    }
  });

  it("Method 1 uses the transit weekday as บริวารจร (e.g. Tuesday → planet 3)", () => {
    // 2026-08-25 is Tuesday
    const tuesday = computeTransitTaksaMethod1(input(25));
    expect(resolveTaksaBirthDay(input(25))).toBe("อังคาร");
    expect(tuesday[0]).toMatchObject({ taksa: "บริวารจร", planetNum: 3 });
    expect(taksaLabelByPlanetNum(tuesday)).toEqual({
      3: "บริวารจร",
      4: "อายุจร",
      7: "เดชจร",
      5: "ศรีจร",
      8: "มูละจร",
      6: "อุตสาหะจร",
      1: "มนตรีจร",
      2: "กาลกิณีจร",
    });
  });

  it("prints template weekday titles for natal and transit grids", () => {
    expect(formatTaksaDayHeading("อาทิตย์", "natal")).toBe("วันอาทิตย์");
    expect(formatTaksaDayHeading("เสาร์", "transit")).toBe("วันเสาร์จร");
    expect(formatTaksaDayHeading("พุธกลางคืน", "transit")).toBe("วันพุธกลางคืนจร");
  });
});

describe("ทักษาปีจร (อายุย่าง)", () => {
  const wednesdayNight: BirthInputSnapshot = {
    day: 26,
    month: 8,
    year: 2026,
    time: "20:00",
    country: "ไทย",
    province: "กรุงเทพมหานคร",
    district: "วัฒนา",
  };

  it("counts อายุย่างเข้า as completed years plus one", () => {
    expect(yangKaoAge(wednesdayNight, new Date(2026, 7, 26, 12))).toBe(1);
    expect(yangKaoAge(wednesdayNight, new Date(2027, 7, 25, 12))).toBe(1);
    expect(yangKaoAge(wednesdayNight, new Date(2027, 7, 26, 12))).toBe(2);
  });

  it("puts บริวารจร on ๑ in year 3, matching the combined MyHora overlay", () => {
    const asOf = new Date(2028, 7, 26, 12);
    expect(resolveTaksaBirthDay(wednesdayNight)).toBe("พุธกลางคืน");
    expect(yangKaoAge(wednesdayNight, asOf)).toBe(3);
    const withCenter = computeTransitTaksaByAge(wednesdayNight, asOf, true);
    const withoutCenter = computeTransitTaksaByAge(wednesdayNight, asOf, false);
    expect(withCenter.slots[0]).toMatchObject({ taksa: "บริวารจร", planetNum: 1 });
    expect(withoutCenter.slots[0]).toMatchObject({
      taksa: "บริวารจร",
      planetNum: 1,
    });
  });

  it("lands บริวารจร on Ketu in year 9 when counting through the centre", () => {
    const asOf = new Date(2034, 7, 26, 12);
    expect(yangKaoAge(wednesdayNight, asOf)).toBe(9);
    const withCenter = computeTransitTaksaByAge(wednesdayNight, asOf, true);
    expect(withCenter.centerIsBorivanTransit).toBe(true);
    expect(withCenter.slots.some((slot) => slot.taksa === "บริวารจร")).toBe(
      false,
    );
    const withoutCenter = computeTransitTaksaByAge(wednesdayNight, asOf, false);
    expect(withoutCenter.centerIsBorivanTransit).toBe(false);
    expect(withoutCenter.slots[0]).toMatchObject({
      taksa: "บริวารจร",
      planetNum: 8,
    });
  });

  it("reads natal + จร labels from a scraped MyHora grid", () => {
    const grid = TAKSA_CELL_PLANETS.map((row) =>
      row.map((planetNum) => {
        if (planetNum === 9) {
          return {
            label: "กลาง",
            planetNum: 9,
            transitLabel: "",
            isCenter: true,
          };
        }
        const natal = TAKSA_WEEKDAY_TABLE.พุธกลางคืน.find(
          (slot) => slot.planetNum === planetNum,
        )!;
        const transit = slotsForWeekday("อาทิตย์", "transit").find(
          (slot) => slot.planetNum === planetNum,
        )!;
        return {
          label: natal.taksa,
          planetNum,
          transitLabel: transit.taksa,
          highlighted: transit.taksa === "บริวารจร",
        };
      }),
    );
    const combined = combinedGridFromScraped(grid);
    expect(combined?.find((cell) => cell.planetNum === 1)).toMatchObject({
      natalLabel: "เดช",
      transitLabel: "บริวารจร",
      highlightTransit: true,
    });
    expect(combined?.find((cell) => cell.planetNum === 9)?.isCenter).toBe(true);
  });
});
