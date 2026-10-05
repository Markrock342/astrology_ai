import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/ai/router", () => ({ generateWithFallback: vi.fn() }));
vi.mock("@/server/ai/usage-logger", () => ({ logUsage: vi.fn() }));
vi.mock("@/server/horoscope/follow-up-suggestions", () => ({ resolveAuxConfig: vi.fn(async () => null) }));

import { findGlitchedLines, repairScriptGlitches, stripGlitches } from "@/server/ai/script-repair";

// 5 Oct 2026, from a user: Arabic and Latin letters inside "อุปสรรค".
const SEEN = "ควรระมัดระวังเรื่องภาระต้นทุนหรืออุปظـسakเฉพาะหน้าที่อาจเกิดขึ้นจากดาวเสาร์";

describe("other scripts inside Thai words", () => {
  it("finds the line and leaves clean Thai, English terms and numbers alone", () => {
    expect(findGlitchedLines(`บรรทัดดี\n${SEEN}\nดวง AI ปี 2569 ใช้ Gemini ได้`)).toEqual([1]);
  });

  it("strips the stray letters when no model can mend them", async () => {
    expect(stripGlitches(SEEN)).not.toMatch(/[؀-ۿ]|ak/);
    const out = await repairScriptGlitches(`หัวข้อ\n${SEEN}`, "u1");
    expect(out.split("\n")[0]).toBe("หัวข้อ");
    expect(findGlitchedLines(out)).toEqual([]);
  });
});
