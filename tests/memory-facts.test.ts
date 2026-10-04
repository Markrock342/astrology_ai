import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/db", () => ({ prisma: {} }));
vi.mock("@/server/ai/router", () => ({ generateWithFallback: vi.fn() }));
vi.mock("@/server/ai/usage-logger", () => ({ logUsage: vi.fn() }));
vi.mock("@/server/horoscope/follow-up-suggestions", () => ({ resolveAuxConfig: vi.fn() }));

import { sanitizeFactChanges } from "@/server/memory/fact-memory-service";
import { formatUserFactsForPrompt } from "@/server/user/ai-memory-service";

describe("saved memories", () => {
  it("keeps facts about the user and drops anyone's birth data", () => {
    const out = sanitizeFactChanges(
      {
        add: [
          "ทำงานฟรีแลนซ์ออกแบบกราฟิก",
          "มีนัดคุยงานกับลูกค้าวันที่ 14 ต.ค. 2569",
          "แฟนเกิดวันที่ 3 มี.ค. 2538 เวลา 10.30 น.",
          "วันเกิดแม่คือ 12 ส.ค.",
          "ok",
        ],
        update: [{ id: "f1", text: "ย้ายไปทำงานประจำแล้ว" }, { id: "ghost", text: "x".repeat(10) }],
        remove: ["f2", "nope"],
      },
      new Set(["f1", "f2"]),
    );
    expect(out.add).toEqual(["ทำงานฟรีแลนซ์ออกแบบกราฟิก", "มีนัดคุยงานกับลูกค้าวันที่ 14 ต.ค. 2569"]);
    expect(out.update).toEqual([{ id: "f1", text: "ย้ายไปทำงานประจำแล้ว" }]);
    expect(out.remove).toEqual(["f2"]);
  });

  it("puts what the user told about themselves into every chat's context", () => {
    const text = formatUserFactsForPrompt({
      enabled: true,
      nickname: null,
      resetAt: null,
      commonTopics: [],
      recentQuestions: [],
      facts: [{ id: "f1", text: "ทำงานฟรีแลนซ์ออกแบบกราฟิก", updatedAt: "" }],
    });
    expect(text).toContain("[user_facts]");
    expect(text).toContain("- ทำงานฟรีแลนซ์ออกแบบกราฟิก");
  });
});
