import { beforeEach, describe, expect, it, vi } from "vitest";
import { requestStopGeneration } from "@/server/horoscope/message-service";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: {
    message: { findFirst: mocks.findFirst, update: mocks.update },
  },
}));

// message-service pulls in the whole AI chain on import; none of it is exercised
// by the stop path, so stub it out rather than booting real provider config.
vi.mock("@/server/user/account-service", () => ({ getEffectivePlan: vi.fn() }));
vi.mock("@/server/horoscope/reading-service", () => ({
  createReading: vi.fn(),
  streamReading: vi.fn(),
}));
vi.mock("@/server/horoscope/thread-service", () => ({
  loadPriorMessages: vi.fn(),
  appendUserMessage: vi.fn(),
  createPendingAssistant: vi.fn(),
  finalizeAssistantMessage: vi.fn(),
  appendExchangeToConversation: vi.fn(),
}));
vi.mock("@/server/app/bootstrap-cache", () => ({
  invalidateUserBootstrap: vi.fn(),
}));

const BASE = {
  conversationId: "c1",
  userId: "u1",
  idempotencyKey: "k1",
};

describe("requestStopGeneration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.update.mockResolvedValue({});
  });

  it("flags a live answer so the streaming request cancels it", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "m1",
      createdAt: new Date(Date.now() - 3_000),
      content: "",
    });

    await expect(requestStopGeneration(BASE)).resolves.toBe(true);

    const data = mocks.update.mock.calls[0][0].data;
    expect(data).toEqual({ stopRequested: true });
    // A live turn must stay PENDING: its own stream finalizes it with the text
    // that already streamed, and charges for it.
    expect(data.status).toBeUndefined();
  });

  it("closes out a stranded answer, because no generation is left to see the flag", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "m1",
      createdAt: new Date(Date.now() - 5 * 60_000),
      content: "",
    });

    await expect(requestStopGeneration(BASE)).resolves.toBe(true);

    const data = mocks.update.mock.calls[0][0].data;
    expect(data.status).toBe("FAILED");
    expect(data.creditCost).toBe(0);
  });

  it("reports nothing to stop when the answer already landed", async () => {
    mocks.findFirst.mockResolvedValue(null);

    await expect(requestStopGeneration(BASE)).resolves.toBe(false);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
