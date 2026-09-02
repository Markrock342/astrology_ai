import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import { createConversation, sendMessage } from "@/server/horoscope/message-service";

const mocks = vi.hoisted(() => ({
  findConversation: vi.fn(),
  findMessage: vi.fn(),
  findReading: vi.fn(),
  findMessages: vi.fn(),
  findCategory: vi.fn(),
  findCategories: vi.fn(),
  findBirthProfile: vi.fn(),
  createConversation: vi.fn(),
  transaction: vi.fn(),
  getEffectivePlan: vi.fn(),
  createReading: vi.fn(),
  appendUserMessage: vi.fn(),
  createPendingAssistant: vi.fn(),
  findPriorUserMessage: vi.fn(),
  finalizeAssistantMessage: vi.fn(),
  messageUpdate: vi.fn(),
  messageUpdateMany: vi.fn(),
  messageCount: vi.fn(),
  assertCanRequestReading: vi.fn(),
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
      // acceptMessage now issues TWO findFirst queries, and they must not answer
      // each other: the live assistant placeholder is looked up by
      // idempotencyKey (findUnique cannot express `deletedAt: null`), while the
      // preceding question is looked up by role. Route on the shape of the
      // query, or the priorUser stub masquerades as an existing turn and the
      // send short-circuits.
      findFirst: (args: { where?: Record<string, unknown> }) =>
        args?.where?.idempotencyKey
          ? mocks.findMessage(args)
          : mocks.findPriorUserMessage(args),
      findMany: mocks.findMessages,
      create: vi.fn(),
      update: mocks.messageUpdate,
      updateMany: mocks.messageUpdateMany,
      count: mocks.messageCount,
    },
    horoscopeReading: { findUnique: mocks.findReading },
    horoscopeCategory: {
      findFirst: mocks.findCategory,
      findMany: mocks.findCategories,
    },
    birthProfile: { findUnique: mocks.findBirthProfile },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/server/user/account-service", () => ({
  getEffectivePlan: mocks.getEffectivePlan,
}));

// The free-tier policy has its own suite (access-policy.test.ts); here we only
// care that assertCanSend consults it, and with the right follow-up flag.
vi.mock("@/server/horoscope/access-policy", () => ({
  assertCanRequestReading: mocks.assertCanRequestReading,
}));

vi.mock("@/server/horoscope/reading-service", () => ({
  createReading: mocks.createReading,
}));

vi.mock("@/server/horoscope/thread-service", () => ({
  loadPriorMessages: mocks.findMessages,
  appendUserMessage: mocks.appendUserMessage,
  createPendingAssistant: mocks.createPendingAssistant,
  finalizeAssistantMessage: mocks.finalizeAssistantMessage,
  appendExchangeToConversation: vi.fn().mockResolvedValue(undefined),
}));

const conversation = {
  id: "conv-1",
  userId: "user-1",
  mode: "TRANSIT" as const,
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
    // appendUserMessage now returns the created row — acceptMessage hands the
    // real id back to the client so edit/regenerate can address it.
    mocks.appendUserMessage.mockResolvedValue({ id: "msg-user-1" });
    mocks.findPriorUserMessage.mockResolvedValue({ id: "msg-user-1" });
    mocks.createPendingAssistant.mockResolvedValue({ id: "pend-1" });
    mocks.finalizeAssistantMessage.mockResolvedValue(undefined);
    mocks.messageUpdateMany.mockResolvedValue({ count: 0 });
    mocks.messageCount.mockResolvedValue(0);
    mocks.assertCanRequestReading.mockResolvedValue("PRO");
    mocks.findCategories.mockResolvedValue([]);
    mocks.findBirthProfile.mockResolvedValue(null);
  });

  it("refuses the send when the access policy refuses it", async () => {
    mocks.assertCanRequestReading.mockRejectedValue(
      new AppError("CATEGORY_LOCKED", "หมวดนี้สำหรับสมาชิก Pro"),
    );

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

  it("tells the policy this is a follow-up once the thread already has an answer", async () => {
    mocks.messageCount.mockResolvedValue(1);

    await sendMessage({
      conversationId: "conv-1",
      userId: "user-1",
      content: "แล้วปีหน้าล่ะ",
      idempotencyKey: "k2",
    });

    expect(mocks.assertCanRequestReading).toHaveBeenCalledWith(
      expect.objectContaining({ isFollowUp: true }),
    );
  });

  it("tells the policy the opening turn is not a follow-up", async () => {
    mocks.messageCount.mockResolvedValue(0);

    await sendMessage({
      conversationId: "conv-1",
      userId: "user-1",
      content: "สวัสดี",
      idempotencyKey: "k3",
    });

    expect(mocks.assertCanRequestReading).toHaveBeenCalledWith(
      expect.objectContaining({ isFollowUp: false }),
    );
  });

  it("returns existing reading on idempotent retry without calling AI again", async () => {
    const existingReading = {
      id: "reading-1",
      responseText: "เดิม",
      provider: "GEMINI",
      modelId: "gemini",
      creditCost: 1,
      status: "SUCCESS",
    };
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

    expect(result).toMatchObject({ id: "reading-1", responseText: "เดิม" });
    expect(mocks.createReading).not.toHaveBeenCalled();
  });

  it("passes prior messages into createReading via loadPriorMessages", async () => {
    mocks.findMessages.mockResolvedValue([
      { role: "USER", content: "คำถามแรก" },
      { role: "ASSISTANT", content: "คำตอบแรก" },
    ]);
    mocks.findMessage
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "pend-1",
        status: "PENDING",
        content: "",
      });

    await sendMessage({
      conversationId: "conv-1",
      userId: "user-1",
      content: "คำถามต่อ",
      idempotencyKey: "k2",
    });

    expect(mocks.appendUserMessage).toHaveBeenCalled();
    expect(mocks.createPendingAssistant).toHaveBeenCalled();
    expect(mocks.createReading).toHaveBeenCalledWith(
      expect.objectContaining({
        priorMessages: [
          { role: "USER", content: "คำถามแรก" },
          { role: "ASSISTANT", content: "คำตอบแรก" },
        ],
        question: "คำถามต่อ",
      }),
    );
    expect(mocks.finalizeAssistantMessage).toHaveBeenCalled();
  });
});

describe("natal category intro", () => {
  const natal = {
    ...conversation,
    mode: "NATAL" as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findConversation.mockResolvedValue(natal);
    mocks.findMessage.mockResolvedValue(null);
    mocks.findMessages.mockResolvedValue([]);
    mocks.getEffectivePlan.mockResolvedValue("PRO");
    mocks.createReading.mockResolvedValue({
      id: "reading-1",
      responseText: "สรุป",
      provider: "GEMINI",
      modelId: "gemini",
      creditCost: 0,
      status: "SUCCESS",
    });
    mocks.transaction.mockResolvedValue([]);
    mocks.appendUserMessage.mockResolvedValue({ id: "msg-user-1" });
    mocks.findPriorUserMessage.mockResolvedValue({ id: "msg-user-1" });
    mocks.createPendingAssistant.mockResolvedValue({ id: "pend-1" });
    mocks.finalizeAssistantMessage.mockResolvedValue(undefined);
    mocks.messageUpdateMany.mockResolvedValue({ count: 0 });
    mocks.messageCount.mockResolvedValue(0);
    mocks.assertCanRequestReading.mockResolvedValue("PRO");
    mocks.findCategories.mockResolvedValue([]);
    mocks.findBirthProfile.mockResolvedValue(null);
  });

  it("allows a natal follow-up question in the same chat", async () => {
    mocks.findMessage
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "pend-1",
        status: "PENDING",
        content: "",
      });

    await sendMessage({
      conversationId: "conv-1",
      userId: "user-1",
      content: "แล้วปีหน้าล่ะ",
      idempotencyKey: "k-natal-q",
    });

    expect(mocks.createReading).toHaveBeenCalled();
  });

  it("allows the free category intro and tells the reader to skip credits", async () => {
    mocks.findMessage
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "pend-1",
        status: "PENDING",
        content: "",
      });

    await sendMessage({
      conversationId: "conv-1",
      userId: "user-1",
      content: "[[category-intro]]\nสรุปหมวดการงาน",
      idempotencyKey: "k-intro",
      purpose: "category_intro",
    });

    expect(mocks.createReading).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: "category_intro" }),
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

  it("lets a Free user open a live-transit thread on a Free category", async () => {
    mocks.findCategory.mockResolvedValue({
      id: "cat-career",
      slug: "career",
      accessLevel: "FREE",
      enabled: true,
    });
    mocks.createConversation.mockResolvedValue({
      id: "conv-t",
      mode: "TRANSIT",
      category: { slug: "career", accessLevel: "FREE" },
    });

    await expect(
      createConversation({
        userId: "user-1",
        categorySlug: "career",
        mode: "TRANSIT",
      }),
    ).resolves.toMatchObject({ id: "conv-t" });
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
