import { describe, expect, it } from "vitest";
import { smallTalkKind } from "@/lib/small-talk";

describe("smallTalkKind", () => {
  it("catches tests, greetings and thanks", () => {
    for (const m of ["เทส", "เทสๆ", "test", "ทดสอบ", "สวัสดีครับ", "หวัดดีค่ะ", "555555", "โอเคครับ", "hi", "?", "ลองดู"]) {
      expect(smallTalkKind(m), m).toBe("greeting");
    }
    for (const m of ["ขอบคุณครับ", "ขอบคุณมากค่ะ", "thanks"]) expect(smallTalkKind(m), m).toBe("thanks");
  });
  it("leaves real questions alone", () => {
    for (const m of ["งาน?", "เทสต์ดวงความรักหน่อย", "สวัสดีครับ ปีนี้งานเป็นยังไง", "ลองดูดวงเดือนนี้", "เงินจะมาไหม", "ได้งานไหม", "14 ผมมีนัด"]) {
      expect(smallTalkKind(m), m).toBeNull();
    }
  });
});
