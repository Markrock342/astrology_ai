import { describe, expect, it } from "vitest";
import { stableBlockBoundary } from "@/components/app/chat-markdown";

describe("stableBlockBoundary", () => {
  it("cuts after the last completed paragraph", () => {
    const text = "para one\n\npara two\n\npara thr";
    expect(text.slice(0, stableBlockBoundary(text))).toBe("para one\n\npara two\n\n");
  });

  it("never cuts inside an open code fence", () => {
    const text = "intro\n\n```ts\nconst a = 1;\n\nconst b = 2;";
    expect(text.slice(0, stableBlockBoundary(text))).toBe("intro\n\n");
  });

  it("keeps a loose list together so numbering does not restart", () => {
    const text = "ก่อน\n\n1. หนึ่ง\n\n2. สอง\n\n3. สา";
    expect(text.slice(0, stableBlockBoundary(text))).toBe("ก่อน\n\n");
  });

  it("returns 0 when no block has settled yet", () => {
    expect(stableBlockBoundary("still typing the first para")).toBe(0);
  });
});
