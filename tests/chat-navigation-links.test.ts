import { describe, expect, it } from "vitest";
import {
  categorySlugFromLabel,
  linkChatNavigationCtas,
  natalCategoryHref,
  parseDashboardChatHref,
  transitCategoryHref,
} from "@/lib/chat-navigation-links";

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

  it("links a delimited category name without the หมวด prefix", () => {
    expect(linkChatNavigationCtas("ลองดู 「การงาน」 ด้วย")).toBe(
      "ลองดู [**การงาน**](/dashboard?cat=career) ด้วย",
    );
  });

  it("fills in a missing cat query on a model-emitted category link", () => {
    expect(linkChatNavigationCtas("[**การงาน**](/dashboard)")).toBe(
      "[**การงาน**](/dashboard?cat=career)",
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

describe("parseDashboardChatHref", () => {
  it("reads action and cat together", () => {
    expect(
      parseDashboardChatHref("/dashboard?action=transit&cat=career"),
    ).toEqual({
      isDashboard: true,
      action: "transit",
      cat: "career",
    });
  });

  it("ignores non-dashboard paths", () => {
    expect(parseDashboardChatHref("/account")).toEqual({
      isDashboard: false,
      action: null,
      cat: null,
    });
  });
});

describe("categorySlugFromLabel", () => {
  it("maps Thai labels and หมวด prefixes", () => {
    expect(categorySlugFromLabel("การงาน")).toBe("career");
    expect(categorySlugFromLabel("หมวดความรัก")).toBe("love");
    expect(categorySlugFromLabel("**การเงิน**")).toBe("finance");
    expect(categorySlugFromLabel(" unrelated ")).toBeNull();
  });

  it("builds a natal category href", () => {
    expect(natalCategoryHref("career")).toBe("/dashboard?cat=career");
  });

  it("builds a transit category href for the home picker", () => {
    expect(transitCategoryHref("love")).toBe(
      "/dashboard?action=transit&cat=love",
    );
  });
});
