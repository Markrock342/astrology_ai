import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  appendExchangeToConversation,
  getThreadDetail,
  listConversationThreads,
  pollThreadForUser,
} from "@/server/horoscope/thread-service";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  count: vi.fn(),
  transaction: vi.fn(),
  messageCreate: vi.fn(),
  conversationUpdate: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    conversation: {
      findMany: mocks.findMany,
      findFirst: mocks.findFirst,
      update: mocks.conversationUpdate,
    },
    horoscopeReading: { findFirst: mocks.findFirst },
    message: {
      findUnique: mocks.findUnique,
      create: mocks.messageCreate,
      count: mocks.count,
    },
    $transaction: mocks.transaction,
  },
}));

describe("listConversationThreads (M3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([
      {
        id: "conv-1",
        title: null,
        updatedAt: new Date("2026-07-01T10:00:00Z"),
        category: { slug: "career", nameTh: "การงาน" },
      },
    ]);
  });

  it("lists natal conversations with title or category fallback", async () => {
    const rows = await listConversationThreads("user-1", "NATAL");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "conv-1",
      categorySlug: "career",
      title: "การงาน",
    });
  });
});

describe("getThreadDetail (M3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all messages from a conversation thread", async () => {
    mocks.findFirst.mockResolvedValueOnce({
      id: "conv-1",
      mode: "NATAL",
      category: { slug: "career", nameTh: "การงาน" },
      messages: [
        { id: "m1", role: "USER", content: "คำถาม", modelId: null },
        { id: "m2", role: "ASSISTANT", content: "คำตอบ", modelId: "gemini" },
      ],
    });

    const detail = await getThreadDetail("user-1", "conv-1");
    expect(detail.messages).toHaveLength(2);
    expect(detail.messages[0]).toEqual({
      id: "m1",
      role: "user",
      content: "คำถาม",
      modelId: undefined,
    });
    expect(detail.mode).toBe("NATAL");
  });

  it("falls back to legacy HoroscopeReading when conversation is missing", async () => {
    mocks.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "reading-1",
        question: "คำถามเก่า",
        responseText: "คำตอบเก่า",
        modelId: "gemini",
        category: { slug: "career", nameTh: "การงาน" },
      });

    const detail = await getThreadDetail("user-1", "reading-1");
    expect(detail.id).toBe("reading-1");
    expect(detail.messages).toHaveLength(2);
    expect(detail.messages[1].content).toBe("คำตอบเก่า");
  });
});

describe("pollThreadForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findFirst.mockResolvedValue({ id: "conv-1" });
  });

  it("returns hasPending without loading full messages", async () => {
    mocks.count.mockResolvedValue(1);
    const result = await pollThreadForUser("user-1", "conv-1");
    expect(result).toEqual({ hasPending: true, messages: null });
    expect(mocks.count).toHaveBeenCalled();
  });

  it("loads full thread when no pending messages remain", async () => {
    mocks.count.mockResolvedValue(0);
    mocks.findFirst
      .mockResolvedValueOnce({ id: "conv-1" })
      .mockResolvedValueOnce({
        id: "conv-1",
        mode: "NATAL",
        transitDate: null,
        transitTime: null,
        transitCountry: null,
        transitProvince: null,
        transitDistrict: null,
        category: { slug: "career", nameTh: "การงาน" },
        messages: [
          { id: "m1", role: "USER", content: "q", modelId: null, status: "SUCCESS" },
          { id: "m2", role: "ASSISTANT", content: "a", modelId: "g", status: "SUCCESS" },
        ],
      });

    const result = await pollThreadForUser("user-1", "conv-1");
    expect(result.hasPending).toBe(false);
    expect(result.messages).toHaveLength(2);
  });
});

describe("appendExchangeToConversation (M3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findFirst.mockResolvedValue({ id: "conv-1", title: null });
    mocks.findUnique.mockResolvedValue(null);
    mocks.transaction.mockResolvedValue([]);
  });

  it("skips duplicate assistant rows for the same idempotency key", async () => {
    mocks.findUnique.mockResolvedValue({ id: "msg-dup" });

    await appendExchangeToConversation({
      conversationId: "conv-1",
      userId: "user-1",
      userContent: "สวัสดี",
      idempotencyKey: "key-1",
      assistantContent: "ตอบ",
      creditCost: 1,
      status: "SUCCESS",
    });

    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("persists user + assistant messages and sets title on first exchange", async () => {
    await appendExchangeToConversation({
      conversationId: "conv-1",
      userId: "user-1",
      userContent: "เรื่องความรัก",
      idempotencyKey: "key-2",
      assistantContent: "ดวงความรักดี",
      provider: "GEMINI",
      modelId: "gemini",
      creditCost: 1,
      status: "SUCCESS",
    });

    expect(mocks.transaction).toHaveBeenCalledOnce();
  });
});
