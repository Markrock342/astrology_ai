import { describe, expect, it } from "vitest";
import { linkChatNavigationCtas } from "@/lib/chat-navigation-links";

describe("linkChatNavigationCtas", () => {
  it("turns the transit CTA into a bold internal link", () => {
    expect(linkChatNavigationCtas("เลือกเมนู 「เริ่มดวงจร」 ได้เลย")).toBe(
      "เลือกเมนู [**เริ่มดวงจร**](/dashboard?action=transit) ได้เลย",
    );
  });

  it("links explicitly recommended categories without linking ordinary prose", () => {
    expect(
      linkChatNavigationCtas("ลองดู 「หมวดความรัก」 ส่วนความรักต้องค่อยเป็นค่อยไป"),
    ).toBe(
      "ลองดู [**หมวดความรัก**](/dashboard?cat=love) ส่วนความรักต้องค่อยเป็นค่อยไป",
    );
  });

  it("does not nest a link already emitted by the model", () => {
    const markdown = "[**เริ่มดวงจร**](/dashboard?action=transit)";
    expect(linkChatNavigationCtas(markdown)).toBe(markdown);
  });

  it("does not alter fenced code blocks", () => {
    const markdown = "```\nเริ่มดวงจร\n```";
    expect(linkChatNavigationCtas(markdown)).toBe(markdown);
  });

  it("does not link a bare prose mention without the 「」 delimiters", () => {
    const prose = "การเริ่มดวงจรเป็นเรื่องดีในช่วงนี้";
    expect(linkChatNavigationCtas(prose)).toBe(prose);
  });
});
