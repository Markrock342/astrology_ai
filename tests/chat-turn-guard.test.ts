import { describe, expect, it } from "vitest";
import {
  assistantIdForTurn,
  resolveActiveAssistantId,
  shouldBlockFollowUpSend,
} from "@/lib/chat-turn-guard";

describe("shouldBlockFollowUpSend", () => {
  it("blocks when an active turn lock is held", () => {
    expect(
      shouldBlockFollowUpSend({
        state: "idle",
        inFlight: false,
        activeTurn: {
          idempotencyKey: "k1",
          assistantId: "stream-k1",
          threadId: "t1",
        },
        pendingAssistant: false,
        bypassBusyGuard: false,
      }),
    ).toBe(true);
  });

  it("blocks when a pending assistant exists", () => {
    expect(
      shouldBlockFollowUpSend({
        state: "processing",
        inFlight: false,
        activeTurn: null,
        pendingAssistant: true,
        bypassBusyGuard: false,
      }),
    ).toBe(true);
  });

  it("blocks when inFlight and streaming", () => {
    expect(
      shouldBlockFollowUpSend({
        state: "streaming",
        inFlight: true,
        activeTurn: null,
        pendingAssistant: false,
        bypassBusyGuard: false,
      }),
    ).toBe(true);
  });

  it("allows retry/regenerate/edit through the guard", () => {
    expect(
      shouldBlockFollowUpSend({
        state: "processing",
        inFlight: true,
        activeTurn: {
          idempotencyKey: "k1",
          assistantId: "stream-k1",
          threadId: "t1",
        },
        pendingAssistant: true,
        bypassBusyGuard: true,
      }),
    ).toBe(false);
  });

  it("allows a new send when idle with no pending turn", () => {
    expect(
      shouldBlockFollowUpSend({
        state: "idle",
        inFlight: false,
        activeTurn: null,
        pendingAssistant: false,
        bypassBusyGuard: false,
      }),
    ).toBe(false);
  });
});

describe("resolveActiveAssistantId", () => {
  it("prefers inFlight idempotency key", () => {
    expect(resolveActiveAssistantId("k-live", null)).toBe("stream-k-live");
  });

  it("falls back to active turn assistant id", () => {
    expect(
      resolveActiveAssistantId(null, {
        idempotencyKey: "k2",
        assistantId: "stream-k2",
        threadId: "t1",
      }),
    ).toBe("stream-k2");
  });

  it("returns null when no active turn", () => {
    expect(resolveActiveAssistantId(null, null)).toBeNull();
  });
});

describe("assistantIdForTurn", () => {
  it("builds stream placeholder id", () => {
    expect(assistantIdForTurn("abc")).toBe("stream-abc");
  });
});
