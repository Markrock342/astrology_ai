import { describe, expect, it } from "vitest";
import {
  isSseActivityEvent,
  mergePollMessages,
  parsePrepPhase,
  prepPhaseLabel,
  shouldRecoverStaleTurn,
  SSE_STREAM_IDLE_MS,
  STALE_TURN_MS,
  STREAM_STALL_MS,
} from "@/lib/chat-sse-activity";

describe("isSseActivityEvent", () => {
  it("treats ping, status, delta, and done as activity", () => {
    expect(isSseActivityEvent("ping")).toBe(true);
    expect(isSseActivityEvent("status")).toBe(true);
    expect(isSseActivityEvent("delta")).toBe(true);
    expect(isSseActivityEvent("done")).toBe(true);
  });

  it("ignores unknown event types", () => {
    expect(isSseActivityEvent("error")).toBe(false);
    expect(isSseActivityEvent(undefined)).toBe(false);
  });
});

describe("parsePrepPhase", () => {
  it("parses valid phases", () => {
    expect(parsePrepPhase("chart")).toBe("chart");
    expect(parsePrepPhase("memory")).toBe("memory");
    expect(parsePrepPhase("writing")).toBe("writing");
  });

  it("returns null for invalid phases", () => {
    expect(parsePrepPhase("waiting")).toBeNull();
  });
});

describe("prepPhaseLabel", () => {
  it("returns phase-specific Thai labels", () => {
    expect(prepPhaseLabel("chart")).toContain("พื้นดวง");
    expect(prepPhaseLabel("writing")).toContain("คำทำนาย");
  });

  it("falls back to default label", () => {
    expect(prepPhaseLabel(null)).toBe("กำลังเพ่งดวงดาว…");
  });
});

describe("shouldRecoverStaleTurn", () => {
  const started = 1_000_000;

  it("does not recover during prep within STALE_TURN_MS", () => {
    expect(
      shouldRecoverStaleTurn({
        startedAt: started,
        lastActivityAt: started + 60_000,
        now: started + 90_000,
        isStreaming: false,
        hasReceivedDelta: false,
      }),
    ).toBe(false);
  });

  it("recovers after STALE_TURN_MS without activity", () => {
    expect(
      shouldRecoverStaleTurn({
        startedAt: started,
        lastActivityAt: started,
        now: started + STALE_TURN_MS,
        isStreaming: false,
        hasReceivedDelta: false,
      }),
    ).toBe(true);
  });

  it("uses shorter STREAM_STALL_MS after streaming deltas", () => {
    expect(
      shouldRecoverStaleTurn({
        startedAt: started,
        lastActivityAt: started + 100_000,
        now: started + 100_000 + STREAM_STALL_MS,
        isStreaming: true,
        hasReceivedDelta: true,
      }),
    ).toBe(true);
  });
});

describe("mergePollMessages", () => {
  it("keeps longer local partial content for pending assistant", () => {
    const local = [
      {
        id: "stream-k1",
        role: "assistant",
        content: "สวัสดีครับ กำลังตอบ",
        status: "PENDING",
        idempotencyKey: "k1",
      },
    ];
    const remote = [
      {
        id: "db-id",
        role: "assistant",
        content: "",
        status: "PENDING",
        idempotencyKey: "k1",
      },
    ];
    const merged = mergePollMessages(local, remote);
    expect(merged[0].content).toBe("สวัสดีครับ กำลังตอบ");
  });

  it("does not override success rows", () => {
    const local = [
      { id: "a1", role: "assistant", content: "partial", status: "PENDING" },
    ];
    const remote = [
      { id: "a1", role: "assistant", content: "final answer", status: "SUCCESS" },
    ];
    expect(mergePollMessages(local, remote)[0].content).toBe("final answer");
  });
});

describe("timeout constants", () => {
  it("aligns idle window with stale prep window", () => {
    expect(SSE_STREAM_IDLE_MS).toBe(STALE_TURN_MS);
  });
});
