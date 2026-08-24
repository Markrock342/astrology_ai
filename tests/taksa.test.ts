import { describe, expect, it } from "vitest";
import {
  computeTaksaFromBirth,
  resolveTaksaBirthDay,
  TAKSA_CELL_PLANETS,
  TAKSA_NAMES,
  TAKSA_WEEKDAY_TABLE,
  taksaSlotsFromMyhoraGrid,
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
      expect(slots.map((slot) => slot.taksa)).toEqual(TAKSA_NAMES);
      expect(new Set(slots.map((slot) => slot.planetNum)).size).toBe(8);
    }
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
