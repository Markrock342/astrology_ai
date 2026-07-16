import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

const mocks = vi.hoisted(() => ({
  messageFindFirst: vi.fn(),
  messageFeedbackCount: vi.fn(),
  messageFeedbackFindMany: vi.fn(),
  messageFeedbackUpsert: vi.fn(),
  messageFeedbackDeleteMany: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    message: { findFirst: mocks.messageFindFirst },
    messageFeedback: {
      count: mocks.messageFeedbackCount,
      findMany: mocks.messageFeedbackFindMany,
      upsert: mocks.messageFeedbackUpsert,
      deleteMany: mocks.messageFeedbackDeleteMany,
    },
  },
}));

import {
  assertFeedbackClient,
  clearMessageFeedback,
  listFeedbackForAdmin,
  submitMessageFeedback,
} from "@/server/horoscope/feedback-service";

describe("assertFeedbackClient", () => {
  it("passes when messageFeedback delegate exists", () => {
    expect(() => assertFeedbackClient()).not.toThrow();
  });
});

describe("listFeedbackForAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.messageFeedbackCount.mockResolvedValue(1);
    mocks.messageFeedbackFindMany.mockResolvedValue([
      {
        id: "fb1",
        value: "DOWN",
        reason: "ไม่ตรง",
        createdAt: new Date("2026-07-15T10:00:00Z"),
        user: { email: "u@test.com", name: "User" },
        message: {
          id: "m1",
          content: "คำตอบ",
          modelId: "gemini",
          conversationId: "c1",
          createdAt: new Date("2026-07-15T09:59:00Z"),
        },
      },
    ]);
    mocks.messageFindFirst.mockResolvedValue({ content: "คำถามเดิม" });
    mocks.messageFeedbackCount
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);
  });

  it("returns items with paired question and stats", async () => {
    const result = await listFeedbackForAdmin({
      value: "DOWN",
      page: 1,
      pageSize: 20,
    });

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].message.question).toBe("คำถามเดิม");
    expect(result.stats.up).toBe(2);
    expect(result.stats.down).toBe(1);
    expect(result.stats.satisfactionPct).toBeCloseTo(66.67, 1);
  });
});

describe("submitMessageFeedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.messageFindFirst.mockResolvedValue({ id: "m1" });
    mocks.messageFeedbackUpsert.mockResolvedValue({
      value: "UP",
      reason: null,
    });
  });

  it("upserts when assistant message belongs to user", async () => {
    const result = await submitMessageFeedback({
      userId: "u1",
      messageId: "m1",
      value: "UP",
    });

    expect(result).toEqual({ messageId: "m1", value: "UP", reason: null });
    expect(mocks.messageFeedbackUpsert).toHaveBeenCalled();
  });

  it("throws NOT_FOUND when message is missing", async () => {
    mocks.messageFindFirst.mockResolvedValue(null);

    await expect(
      submitMessageFeedback({
        userId: "u1",
        messageId: "missing",
        value: "DOWN",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("clearMessageFeedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.messageFeedbackDeleteMany.mockResolvedValue({ count: 1 });
  });

  it("deletes verdict for user and message", async () => {
    const result = await clearMessageFeedback("u1", "m1");
    expect(result).toEqual({ messageId: "m1", value: null });
    expect(mocks.messageFeedbackDeleteMany).toHaveBeenCalledWith({
      where: { messageId: "m1", userId: "u1" },
    });
  });
});

describe("stale Prisma client", () => {
  it("throws a clear error when messageFeedback delegate is missing", async () => {
    vi.resetModules();
    vi.doMock("@/server/db", () => ({
      prisma: { message: { findFirst: vi.fn() } },
    }));

    const mod = await import("@/server/horoscope/feedback-service");
    await expect(
      mod.listFeedbackForAdmin({ page: 1, pageSize: 20 }),
    ).rejects.toMatchObject({
      code: "INTERNAL",
      message: expect.stringContaining("prisma generate"),
    });

    vi.doUnmock("@/server/db");
    vi.resetModules();
  });
});
