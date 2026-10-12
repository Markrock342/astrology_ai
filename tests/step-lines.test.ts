import { describe, expect, it } from "vitest";
import { itemsToLines, linesToItems } from "@/lib/step-lines";

// A, 12 Oct 2026: Enter made a new numbered step; Shift+Enter should break
// the line inside the same step.
describe("step lines", () => {
  it("indented lines continue the step above", () => {
    expect(linesToItems("โอนเงิน\nเพิ่มเพื่อน LINE OA\n  @horasard (มี @ ด้านหน้า)\n\nส่งสลิป")).toEqual([
      "โอนเงิน",
      "เพิ่มเพื่อน LINE OA\n@horasard (มี @ ด้านหน้า)",
      "ส่งสลิป",
    ]);
  });

  it("round-trips through the textarea", () => {
    const items = ["ธนาคาร: กสิกรไทย", "ขั้นตอน:\nเพิ่มเพื่อน\nส่งสลิป"];
    expect(linesToItems(itemsToLines(items))).toEqual(items);
  });

  it("an indented first line is just a step", () => {
    expect(linesToItems("  ข้อแรก")).toEqual(["ข้อแรก"]);
  });
});
