import { describe, expect, it } from "vitest";
import { leadWithDay } from "@/lib/day-scan";

const day = new Date("2026-10-25T17:00:00.000Z"); // 26 ต.ค. 2569, Bangkok

describe("leadWithDay", () => {
  it("puts the asked day in front of a bare verdict", () => {
    expect(leadWithDay("ดีครับ มีเกณฑ์ที่ดาวจันทร์จรหนุน\n\nรายละเอียด", day)).toBe(
      "วันที่ 26 ต.ค. 2569: ดีครับ มีเกณฑ์ที่ดาวจันทร์จรหนุน\n\nรายละเอียด",
    );
  });
  it("leaves an answer that already names the day", () => {
    for (const t of ["วันจันทร์ที่ 26 ต.ค. 2569 ดีครับ", "26 ตุลาคม ไปสัมภาษณ์ได้ครับ", "วันที่ ๒๖ ต.ค. ดีครับ", "26 ตค. ดีครับ"]) {
      expect(leadWithDay(t, day)).toBe(t);
    }
  });
  it("does not take another day's number for the asked one", () => {
    expect(leadWithDay("วันที่ 6 ต.ค. ดีกว่าครับ", day).startsWith("วันที่ 26 ต.ค. 2569: ")).toBe(true);
  });
  it("adds a bold line above a heading instead of gluing onto it", () => {
    expect(leadWithDay("## ภาพรวม\nดีครับ", day)).toBe("**วันที่ 26 ต.ค. 2569**\n\n## ภาพรวม\nดีครับ");
  });
});
