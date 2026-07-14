import { describe, expect, it } from "vitest";
import { completeMarkdown } from "@/components/app/complete-markdown";

/**
 * The typewriter hands react-markdown a growing PREFIX of the answer, so the
 * parser constantly sees syntactically incomplete markdown and renders exactly
 * that: pipe salad where a table is arriving, raw asterisks around half-typed
 * bold. These assert the prefix is completed before it reaches the renderer.
 *
 * The hard requirement is the last block: a COMPLETE document must survive
 * untouched. This runs on every frame — if it ever rewrites finished text, it
 * corrupts the answer the user actually keeps.
 */
describe("completeMarkdown — half-typed input", () => {
  it("closes an open code fence so the tail is code, not prose", () => {
    const out = completeMarkdown("```python\nprint('hi')");
    expect(out).toBe("```python\nprint('hi')\n```");
  });

  it("leaves a closed fence alone", () => {
    const src = "```python\nprint('hi')\n```";
    expect(completeMarkdown(src)).toBe(src);
  });

  it("withholds a table that has no separator row yet (pipe salad)", () => {
    // Mid-arrival this renders as literal | characters, then SNAPS into a table.
    const out = completeMarkdown("คำทำนาย\n\n| ดาว | เรือน |");
    expect(out).toBe("คำทำนาย\n");
    expect(out).not.toContain("|");
  });

  it("keeps a table once the separator has arrived, even mid-row", () => {
    const src = "| ดาว | เรือน |\n|---|---|\n| อาทิตย์ | 10";
    // remark renders the complete rows; the partial one is harmless.
    expect(completeMarkdown(src)).toBe(src);
  });

  it("strips a dangling bold marker", () => {
    expect(completeMarkdown("ดวงของคุณ **")).toBe("ดวงของคุณ ");
  });

  it("strips a dangling inline code marker", () => {
    expect(completeMarkdown("ค่าคือ `")).toBe("ค่าคือ ");
  });

  it("leaves balanced emphasis alone", () => {
    const src = "ดวง **ดีมาก** ช่วงนี้";
    expect(completeMarkdown(src)).toBe(src);
  });
});

describe("completeMarkdown — finished input must survive untouched", () => {
  const finished = [
    ["plain prose", "ช่วงนี้ดวงการงานของคุณกำลังดี"],
    ["heading + list", "## สรุป\n\n- ข้อหนึ่ง\n- ข้อสอง"],
    [
      "a full table",
      "| ดาว | เรือน |\n|---|---|\n| อาทิตย์ | 10 |\n| จันทร์ | 4 |",
    ],
    ["a full code block", "```ts\nconst a = 1;\n```"],
    ["bold and italic", "**เด่น** และ *รอง*"],
    ["empty", ""],
  ] as const;

  it.each(finished)("does not touch %s", (_name, src) => {
    expect(completeMarkdown(src)).toBe(src);
  });
});
