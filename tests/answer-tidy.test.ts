import { describe, expect, it } from "vitest";
import { fixWeekdayClaims, stripInternalMarks } from "@/lib/answer-tidy";

const now = new Date("2026-10-07T03:00:00.000Z");

describe("fixWeekdayClaims", () => {
  it("puts the right weekday on a dated day", () => {
    expect(fixWeekdayClaims("วันจันทร์ที่ 25 ต.ค. 2569 ดีครับ", now)).toBe("วันอาทิตย์ที่ 25 ต.ค. 2569 ดีครับ");
    expect(fixWeekdayClaims("วันพฤหัสที่ 26 ตุลาคม", now)).toBe("วันจันทร์ที่ 26 ตุลาคม");
    expect(fixWeekdayClaims("วันศุกร์ที่ ๙ ต.ค. ๒๕๖๙", now)).toBe("วันศุกร์ที่ ๙ ต.ค. ๒๕๖๙");
  });
  it("leaves a right one alone", () => {
    const t = "วันอาทิตย์ที่ 25 ต.ค. 2569 และวันพฤหัสบดีที่ 29 ต.ค.";
    expect(fixWeekdayClaims(t, now)).toBe(t);
  });
});

describe("stripInternalMarks", () => {
  it("removes block names and English months", () => {
    expect(stripInternalMarks("ตามข้อมูลใน [timeline] ช่วง March 2564")).toBe("ตามข้อมูลในดวงของคุณ ช่วง มีนาคม 2564");
    expect(stripInternalMarks("จุดเปลี่ยน [timeline] ปีนี้")).toBe("จุดเปลี่ยน ปีนี้");
    expect(stripInternalMarks("วันอังคารที่ 20 ต.ค. [+4] ศุกร์(6) กับจันทร์ (2)")).toBe("วันอังคารที่ 20 ต.ค. ศุกร์ กับจันทร์");
  });
});
