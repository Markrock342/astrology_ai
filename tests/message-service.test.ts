import { beforeEach, describe, expect, it, vi } from "vitest";
import { createConversation, sendMessage } from "@/server/horoscope/message-service";

const mocks = vi.hoisted(() => ({
  findConversation: vi.fn(),
  findMessage: vi.fn(),
  findReading: vi.fn(),
  findMessages: vi.fn(),
  findCategory: vi.fn(),
  createConversation: vi.fn(),
  transaction: vi.fn(),
  getEffectivePlan: vi.fn(),
  createReading: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    conversation: {
      findFirst: mocks.findConversation,
      create: mocks.createConversation,
      update: vi.fn(),
    },
    message: {
      findUnique: mocks.findMessage,
      findMany: mocks.findMessages,
      create: vi.fn(),
    },
    horoscopeReading: { findUnique: mocks.findReading },
    horoscopeCategory: { findFirst: mocks.findCategory },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/server/user/account-service", () => ({
  getEffectivePlan: mocks.getEffectivePlan,
}));

vi.mock("@/server/horoscope/reading-service", () => ({
  createReading: mocks.createReading,
}));

const conversation = {
  id: "conv-1",
  userId: "user-1",
  mode: "NATAL" as const,
  category: { slug: "career", nameTh: "การงาน", accessLevel: "FREE" },
};

describe("sendMessage (M3 B2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findConversation.mockResolvedValue(conversation);
    mocks.findMessage.mockResolvedValue(null);
    mocks.findMessages.mockResolvedValue([]);
    mocks.getEffectivePlan.mockResolvedValue("PRO");
    mocks.createReading.mockResolvedValue({
      id: "reading-1",
      responseText: "คำตอบ",
      provider: "GEMINI",
      modelId: "gemini",
      creditCost: 1,
      status: "SUCCESS",
    });
    mocks.transaction.mockResolvedValue([]);
  });

  it("allows Free users on FREE access categories", async () => {
    mocks.getEffectivePlan.mockResolvedValue("FREE");

    await sendMessage({
      conversationId: "conv-1",
      userId: "user-1",
      content: "สวัสดี",
      idempotencyKey: "k1",
    });

    expect(mocks.createReading).toHaveBeenCalled();
  });

  it("throws CATEGORY_LOCKED when Free user messages in Pro category thread", async () => {
    mocks.getEffectivePlan.mockResolvedValue("FREE");
    mocks.findConversation.mockResolvedValue({
      ...conversation,
      category: { slug: "love", nameTh: "ความรัก", accessLevel: "PRO" },
    });

    await expect(
      sendMessage({
        conversationId: "conv-1",
        userId: "user-1",
        content: "สวัสดี",
        idempotencyKey: "k1",
      }),
    ).rejects.toMatchObject({ code: "CATEGORY_LOCKED" });

    expect(mocks.createReading).not.toHaveBeenCalled();
  });

  it("returns existing reading on idempotent retry without calling AI again", async () => {
    const existingReading = { id: "reading-1", responseText: "เดิม" };
    mocks.findMessage.mockResolvedValue({
      id: "msg-asst",
      content: "เดิม",
      provider: "GEMINI",
      modelId: "gemini",
      creditCost: 1,
      status: "SUCCESS",
    });
    mocks.findReading.mockResolvedValue(existingReading);

    const result = await sendMessage({
      conversationId: "conv-1",
      userId: "user-1",
      content: "สวัสดี",
      idempotencyKey: "k-dup",
    });

    expect(result).toBe(existingReading);
    expect(mocks.createReading).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("passes prior messages into createReading", async () => {
    mocks.findMessages.mockResolvedValue([
      { role: "USER", content: "คำถามแรก" },
      { role: "ASSISTANT", content: "คำตอบแรก" },
    ]);

    await sendMessage({
      conversationId: "conv-1",
      userId: "user-1",
      content: "คำถามต่อ",
      idempotencyKey: "k2",
    });

    expect(mocks.createReading).toHaveBeenCalledWith(
      expect.objectContaining({
        priorMessages: [
          { role: "USER", content: "คำถามแรก" },
          { role: "ASSISTANT", content: "คำตอบแรก" },
        ],
        question: "คำถามต่อ",
      }),
    );
  });
});

describe("createConversation (M3 B2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getEffectivePlan.mockResolvedValue("FREE");
    mocks.findCategory.mockResolvedValue({
      id: "cat-1",
      slug: "love",
      accessLevel: "PRO",
      enabled: true,
    });
  });

  it("throws TRANSIT_REQUIRES_PRO when Free user opens transit thread", async () => {
    await expect(
      createConversation({
        userId: "user-1",
        categorySlug: "career",
        mode: "TRANSIT",
      }),
    ).rejects.toMatchObject({ code: "TRANSIT_REQUIRES_PRO" });
  });

  it("throws CATEGORY_LOCKED for Pro-only category on Free plan", async () => {
    await expect(
      createConversation({
        userId: "user-1",
        categorySlug: "love",
        mode: "NATAL",
      }),
    ).rejects.toMatchObject({ code: "CATEGORY_LOCKED" });
  });
});
