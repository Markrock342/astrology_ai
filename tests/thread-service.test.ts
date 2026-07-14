import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  appendExchangeToConversation,
  editUserMessage,
  getThreadDetail,
  listConversationThreads,
  pollThreadForUser,
  prepareRegenerateAssistant,
} from "@/server/horoscope/thread-service";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  count: vi.fn(),
  transaction: vi.fn(),
  messageCreate: vi.fn(),
  messageUpdateMany: vi.fn(),
  messageUpdate: vi.fn(),
  // Kept purely so the soft-delete tests can assert it is NEVER called.
  messageDeleteMany: vi.fn(),
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
      findFirst: mocks.findFirst,
      create: mocks.messageCreate,
      count: mocks.count,
      // getThreadDetail sweeps stranded PENDING turns before reading the thread.
      updateMany: mocks.messageUpdateMany,
      update: mocks.messageUpdate,
      deleteMany: mocks.messageDeleteMany,
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
        {
          id: "m1",
          role: "USER",
          content: "คำถาม",
          modelId: null,
          createdAt: new Date("2026-07-14T10:00:00Z"),
          // getThreadDetail now selects the caller's own verdict.
          feedback: [],
        },
        {
          id: "m2",
          role: "ASSISTANT",
          content: "คำตอบ",
          modelId: "gemini",
          createdAt: new Date("2026-07-14T10:00:05Z"),
          feedback: [],
        },
      ],
    });

    const detail = await getThreadDetail("user-1", "conv-1");
    expect(detail.messages).toHaveLength(2);
    expect(detail.messages[0]).toEqual({
      id: "m1",
      role: "user",
      content: "คำถาม",
      modelId: undefined,
      // Drives the elapsed counter for a PENDING turn, so it must round-trip.
      createdAt: "2026-07-14T10:00:00.000Z",
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
          {
            id: "m1",
            role: "USER",
            content: "q",
            modelId: null,
            status: "SUCCESS",
            createdAt: new Date("2026-07-14T10:00:00Z"),
            feedback: [],
          },
          {
            id: "m2",
            role: "ASSISTANT",
            content: "a",
            modelId: "g",
            status: "SUCCESS",
            createdAt: new Date("2026-07-14T10:00:05Z"),
            feedback: [],
          },
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

describe("soft delete (edit / regenerate must not destroy history)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.conversationUpdate.mockResolvedValue({});
    mocks.messageUpdateMany.mockResolvedValue({ count: 2 });
    // $transaction(fn) — run the callback against the same mocked client.
    mocks.transaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          message: {
            updateMany: mocks.messageUpdateMany,
            update: mocks.messageUpdate,
          },
          conversation: { update: mocks.conversationUpdate },
        }),
    );
  });

  it("editUserMessage HIDES the later turns instead of deleting them", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "m-user",
      conversationId: "conv-1",
      createdAt: new Date("2026-07-14T10:00:00Z"),
    });

    await editUserMessage("user-1", "m-user", "คำถามที่แก้แล้ว");

    // The whole point: nothing is destroyed.
    expect(mocks.messageDeleteMany).not.toHaveBeenCalled();

    // Everything AFTER the edited question is marked, not removed — and the
    // edited question itself survives, because its text is what we rewrite.
    const [args] = mocks.messageUpdateMany.mock.calls.at(-1)!;
    expect(args.where.conversationId).toBe("conv-1");
    expect(args.where.deletedAt).toBeNull();
    expect(args.where.createdAt).toHaveProperty("gt");
    expect(args.data.deletedAt).toBeInstanceOf(Date);

    expect(mocks.messageUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "m-user" },
        data: { content: "คำถามที่แก้แล้ว" },
      }),
    );
  });

  it("releases the idempotency key when superseding a turn", async () => {
    // The key is unique per conversation, and a HIDDEN row still holds it.
    // Deleting the row used to free it; hiding it does not. So retrying the very
    // turn you just discarded (same Idempotency-Key) collided with the ghost:
    // a 500, and the question posted twice.
    mocks.findFirst.mockResolvedValue({
      id: "m-user",
      conversationId: "conv-1",
      createdAt: new Date("2026-07-14T10:00:00Z"),
    });

    await editUserMessage("user-1", "m-user", "แก้ใหม่");

    const [args] = mocks.messageUpdateMany.mock.calls.at(-1)!;
    expect(args.data.idempotencyKey).toBeNull();
  });

  it("prepareRegenerateAssistant hides the old answer and everything after it", async () => {
    const answeredAt = new Date("2026-07-14T10:05:00Z");
    mocks.findFirst
      // the assistant row being regenerated
      .mockResolvedValueOnce({
        id: "m-assistant",
        conversationId: "conv-1",
        createdAt: answeredAt,
      })
      // the question it answered
      .mockResolvedValueOnce({ content: "คำถามเดิม" });

    const result = await prepareRegenerateAssistant("user-1", "m-assistant");

    expect(result.content).toBe("คำถามเดิม");
    expect(mocks.messageDeleteMany).not.toHaveBeenCalled();

    // `gte`, not `gt`: the answer being replaced is superseded too.
    const [args] = mocks.messageUpdateMany.mock.calls.at(-1)!;
    expect(args.where.createdAt).toEqual({ gte: answeredAt });
    expect(args.where.deletedAt).toBeNull();
    expect(args.data.deletedAt).toBeInstanceOf(Date);
  });
});
