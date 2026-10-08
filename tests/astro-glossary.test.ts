import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { withGlossary } from "@/components/app/astro-glossary";

const html = (text: string) => renderToStaticMarkup(createElement("p", null, withGlossary(text)));

describe("withGlossary", () => {
  it("marks astrology terms with their meaning", () => {
    const out = html("ลัคนาราศีกันย์ ดาวพฤหัสจรเข้าภพกัมมะ เป็นเกษตร");
    expect(out).toContain('title="จุดขึ้นของดวงตอนเกิด');
    expect(out).toContain("ภพที่ 10");
    expect(out).toContain("ดาวอยู่บ้านตัวเอง");
  });
  it("leaves everyday words alone", () => {
    expect(html("อาชีพเกษตรกรและเกษตรศาสตร์ เล็งเห็นโอกาส อายุ 30")).not.toContain("<button");
  });
});
