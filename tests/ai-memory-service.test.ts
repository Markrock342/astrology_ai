import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUser: vi.fn(),
  findMessages: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    user: { findUnique: mocks.findUser, update: mocks.updateUser },
    message: { findMany: mocks.findMessages },
  },
}));

import {
  formatUserAiMemoryForPrompt,
  getUserAiMemory,
  resetUserAiMemory,
  setUserAiMemoryEnabled,
} from "@/server/user/ai-memory-service";
import { buildCategoryIntroQuestion } from "@/lib/intake-survey";

describe("user AI memory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUser.mockResolvedValue({
      aiMemoryEnabled: true,
      aiMemoryResetAt: null,
      birthProfile: { nickname: "โก้" },
    });
    mocks.findMessages.mockResolvedValue([]);
    mocks.updateUser.mockResolvedValue({});
  });

  it("builds topic counts and recent context only from user-authored messages", async () => {
    mocks.findMessages.mockResolvedValue([
      {
        content: "ปีนี้ควรเปลี่ยนงานไหม",
        createdAt: new Date("2026-08-23T10:00:00Z"),
        conversation: { category: { slug: "career", nameTh: "การงาน" } },
      },
      {
        content: "เงินเก็บจะดีขึ้นตอนไหน",
        createdAt: new Date("2026-08-22T10:00:00Z"),
        conversation: { category: { slug: "finance", nameTh: "การเงิน" } },
      },
      {
        content: "ปีนี้ควรเปลี่ยนงานไหม",
        createdAt: new Date("2026-08-21T10:00:00Z"),
        conversation: { category: { slug: "career", nameTh: "การงาน" } },
      },
      {
        content: buildCategoryIntroQuestion("การงาน"),
        createdAt: new Date("2026-08-20T10:00:00Z"),
        conversation: { category: { slug: "career", nameTh: "การงาน" } },
      },
    ]);

    const memory = await getUserAiMemory("user-1");
    expect(memory.nickname).toBe("โก้");
    expect(memory.commonTopics).toEqual([
      { slug: "career", label: "การงาน", count: 2 },
      { slug: "finance", label: "การเงิน", count: 1 },
    ]);
    expect(memory.recentQuestions).toHaveLength(2);
    expect(memory.recentQuestions[0]?.question).toBe("ปีนี้ควรเปลี่ยนงานไหม");
  });

  it("does not query chat history while memory is disabled", async () => {
    mocks.findUser.mockResolvedValue({
      aiMemoryEnabled: false,
      aiMemoryResetAt: null,
      birthProfile: { nickname: "โก้" },
    });
    const memory = await getUserAiMemory("user-1");
    expect(memory.enabled).toBe(false);
    expect(memory.recentQuestions).toEqual([]);
    expect(mocks.findMessages).not.toHaveBeenCalled();
  });

  it("applies the reset boundary and excludes the current question", async () => {
    const resetAt = new Date("2026-08-24T00:00:00Z");
    mocks.findUser.mockResolvedValue({
      aiMemoryEnabled: true,
      aiMemoryResetAt: resetAt,
      birthProfile: null,
    });
    await getUserAiMemory("user-1", { excludeQuestion: "คำถามปัจจุบัน" });
    expect(mocks.findMessages).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: { gt: resetAt },
          content: { not: "คำถามปัจจุบัน" },
          role: "USER",
        }),
      }),
    );
  });

  it("formats a bounded, explicit prompt block", () => {
    const text = formatUserAiMemoryForPrompt({
      enabled: true,
      nickname: "โก้",
      resetAt: null,
      commonTopics: [{ slug: "career", label: "การงาน", count: 3 }],
      recentQuestions: [
        { category: "การงาน", question: "ควรย้ายงานไหม", askedAt: "2026-08-24T00:00:00Z" },
      ],
    });
    expect(text).toContain("[user_context]");
    expect(text).toContain("ชื่อเล่นที่ใช้เรียก: โก้");
    expect(text).toContain("การงาน (3)");
  });

  it("updates the preference and resets without deleting messages", async () => {
    await setUserAiMemoryEnabled("user-1", false);
    expect(mocks.updateUser).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { aiMemoryEnabled: false },
    });

    await resetUserAiMemory("user-1");
    expect(mocks.updateUser).toHaveBeenLastCalledWith({
      where: { id: "user-1" },
      data: { aiMemoryResetAt: expect.any(Date) },
    });
  });
});
